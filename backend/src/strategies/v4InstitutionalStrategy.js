const DailyPrice = require('../models/DailyPrice');
const Stock = require('../models/Stock');
const SectorStock = require('../models/SectorStock');
const OiData = require('../models/OiData');
const EventCalendar = require('../models/EventCalendar');

// Utility to calculate ATR
function calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    const tr = [];
    for (let i = 0; i < period; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i + 1].close;
        tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
    return tr.reduce((a, b) => a + b, 0) / period;
}

class V4InstitutionalStrategy {
    async scan() {
        console.log('[V4-Strategy] Starting scan...');
        const today = new Date();
        today.setUTCHours(0,0,0,0);
        
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        // Fetch Macro Events (Budget / RBI)
        const macroEvents = await EventCalendar.find({
            symbol: 'MACRO',
            event_date: { $gte: today, $lte: threeDaysFromNow }
        }).lean();
        
        const isBudgetDay = macroEvents.some(e => /budget/i.test(e.description));
        const isRbiDay = macroEvents.some(e => /rbi/i.test(e.description));

        if (isBudgetDay) {
            console.log('[V4-Strategy] Budget Day detected. Halting scan.');
            return []; // Section 1: No Budget Day (All Stocks)
        }

        // Universe = F&O Only
        const activeStocks = await Stock.find({ isActive: true, isFno: true }).lean();
        const results = [];

        // Fetch Nifty Data
        const niftyDocs = await DailyPrice.find({ symbol: 'NIFTY 50' }).sort({ date: -1 }).limit(10).lean();
        const vixDocs = await DailyPrice.find({ symbol: 'INDIA VIX' }).sort({ date: -1 }).limit(1).lean();
        
        const niftyReturn = niftyDocs.length >= 2 ? (niftyDocs[0].close - niftyDocs[1].close) / niftyDocs[1].close : 0;
        const currentVix = vixDocs.length > 0 ? vixDocs[0].close : 15;
        
        const niftyVwap = niftyDocs.length > 0 ? niftyDocs[0].close : 0; // Approximation if intraday vwap missing
        const isNiftyAboveVwap = niftyDocs.length > 0 && niftyDocs[0].close >= niftyVwap;

        const allSectors = await SectorStock.find().lean();
        const sectorMap = {};
        allSectors.forEach(s => sectorMap[s.symbol] = s.sector_id);

        for (const stock of activeStocks) {
            const symbol = stock.symbol;

            // Section 1: Earnings / Event Check
            const events = await EventCalendar.find({
                symbol,
                event_date: { $gte: today, $lte: threeDaysFromNow }
            }).lean();
            if (events.length > 0) continue; // No Earnings/Event Within Next 3 Days
            
            const sectorId = sectorMap[symbol];
            if (isRbiDay && /bank|fin/i.test(sectorId)) continue; // No RBI Policy Day for Banking

            // Fetch Prices
            const priceDocs = await DailyPrice.find({ symbol }).sort({ date: -1 }).limit(100).lean();
            if (priceDocs.length < 50) continue;

            const latest = priceDocs[0];
            const prev = priceDocs[1];
            if (!latest || !prev) continue;

            // Basic EMAs
            const sma20 = latest.sma20 || priceDocs.slice(0, 20).reduce((sum, p) => sum + p.close, 0) / 20;
            const sma50 = latest.sma50 || priceDocs.slice(0, 50).reduce((sum, p) => sum + p.close, 0) / 50;
            const sma200 = latest.sma200 || priceDocs.reduce((sum, p) => sum + p.close, 0) / priceDocs.length; // Approximate if <200

            // Hard Filters
            const avgVol20 = priceDocs.slice(0, 20).reduce((sum, p) => sum + p.volume, 0) / 20;
            if (latest.volume <= avgVol20) continue;
            if (!(latest.close > sma20 && sma20 > sma50)) continue;
            if (latest.close <= sma200) continue;

            const atr14 = calculateATR(priceDocs, 14);

            // Soft Filter (Delivery)
            let deliveryScore = 0;
            const deliveryPct = latest.deliveryPct || 0;
            if (deliveryPct > 50) deliveryScore = 2;
            else if (deliveryPct < 30) deliveryScore = -2;

            // Section 2: Resistance Definition
            let highest20d = 0;
            for (let i = 1; i <= 20 && i < priceDocs.length; i++) {
                if (priceDocs[i].high > highest20d) highest20d = priceDocs[i].high;
            }
            let resistance = highest20d;

            // Get OI Data
            const oiDoc = await OiData.findOne({ symbol }).sort({ date: -1 }).lean();
            const prevOiDoc = await OiData.findOne({ symbol, date: { $lt: oiDoc ? oiDoc.date : new Date() } }).sort({ date: -1 }).lean();

            let oiScore = 0;
            let autoRejectOi = false;
            let putWritingPresent = false;
            let missingData = [];

            const priceUp = latest.close > prev.close;

            if (!oiDoc) {
                missingData.push('OPTIONS_DATA_MISSING');
            } else {
                if (!oiDoc.maxPain) missingData.push('MAX_PAIN_MISSING');
                if (!oiDoc.topPutStrikes || oiDoc.topPutStrikes.length === 0) missingData.push('STRIKES_DATA_MISSING');
            }

            if (oiDoc && prevOiDoc) {
                // PCR Shift
                if (oiDoc.pcr > prevOiDoc.pcr) oiScore += 5;
                else if (oiDoc.pcr < prevOiDoc.pcr) oiScore -= 3;

                // Top Strikes Analysis
                if (oiDoc.topPutStrikes && oiDoc.topPutStrikes.length > 0) {
                    let writingCount = 0;
                    for (const strike of oiDoc.topPutStrikes) {
                        if (strike.oiChange > 0 && priceUp) { 
                            writingCount++;
                            putWritingPresent = true;
                        }
                        if (strike.oiChange > 0 && !priceUp) { 
                            autoRejectOi = true;
                        }
                    }
                    if (writingCount >= 2) oiScore += 12;
                    else if (writingCount === 1) oiScore += 6; 
                }

                if (oiDoc.topCallStrikes && oiDoc.topCallStrikes.length > 0) {
                    let writingCount = 0;
                    for (const strike of oiDoc.topCallStrikes) {
                        if (strike.oiChange > 0 && !priceUp) { 
                            writingCount++;
                        }
                        if (strike.oiChange > 0 && priceUp) { 
                            autoRejectOi = true;
                        }
                    }
                    if (writingCount >= 2) oiScore += 8;
                }
            }

            if (autoRejectOi) continue;

            // Section 3: Breakout Quality
            let breakoutScore = 0;
            let isBreakout = latest.close > resistance;
            let isPullback = false;

            if (isBreakout) {
                if (latest.volume > 2 * avgVol20) breakoutScore += 10;
                if ((latest.high - latest.low) > atr14) breakoutScore += 5;
                const closePos = (latest.close - latest.low) / (latest.high - latest.low || 1);
                if (closePos > 0.75) breakoutScore += 5;
                if (putWritingPresent) breakoutScore += 5;
            } else {
                // Pullback Logic
                const recentBreakoutIndex = priceDocs.findIndex(p => p.close > resistance && p.volume > 2 * avgVol20);
                if (recentBreakoutIndex > 0 && recentBreakoutIndex <= 5) {
                    const brkHigh = priceDocs[recentBreakoutIndex].high;
                    const baseLow = Math.min(...priceDocs.slice(recentBreakoutIndex + 1, recentBreakoutIndex + 6).map(p => p.low));
                    const range = brkHigh - baseLow;
                    const retracement = (brkHigh - latest.close) / (range || 1);
                    
                    if (retracement > 0.5) continue; 
                    isPullback = true;

                    const brkVol = priceDocs[recentBreakoutIndex].volume;
                    if (latest.volume < 0.7 * brkVol) breakoutScore += 10; 

                    if (latest.low <= sma20 && latest.close >= sma20) breakoutScore += 10;
                }
            }

            if (!isBreakout && !isPullback) continue;

            // Volume Score
            let volScore = 0;
            const rvol = latest.volume / (avgVol20 || 1);
            if (rvol > 2.0) volScore += 15;
            else if (rvol >= 1.5) volScore += 10;

            // Space Score
            let spaceScore = 0;
            const dist = isBreakout ? (resistance - latest.close) : 0;
            if (dist > atr14) spaceScore += 10;
            else if (dist >= 0.7 * atr14) spaceScore += 5;

            // Max Pain
            if (oiDoc && oiDoc.maxPain) {
                if (oiDoc.maxPain > latest.close) spaceScore += 5;
                else spaceScore -= 3;
            }

            // RS Score
            let rsScore = 0;
            const stockReturn = (latest.close - prev.close) / prev.close;
            let sectorReturn = 0;
            if (sectorId) {
                const secDoc = await DailyPrice.find({ symbol: sectorId }).sort({ date: -1 }).limit(2).lean();
                if (secDoc.length === 2) sectorReturn = (secDoc[0].close - secDoc[1].close) / secDoc[1].close;
            }
            if (stockReturn > sectorReturn && sectorReturn > niftyReturn) rsScore += 10;
            else if (stockReturn > niftyReturn && stockReturn < sectorReturn) rsScore += 5;

            // Market Score
            let mktScore = 0;
            if (isNiftyAboveVwap) mktScore += 3;
            if (currentVix < 14) mktScore += 3;
            if (currentVix > 16) continue; 
            if (sectorReturn > 0) mktScore += 4;

            const totalScore = oiScore + breakoutScore + volScore + spaceScore + rsScore + mktScore + deliveryScore;

            // RR Check
            const entry = latest.close;
            const stopLoss = Math.max(latest.low, entry - atr14); 
            const risk = entry - stopLoss;
            const target1 = entry + Math.max(2 * atr14, 2 * risk);
            const rr = (target1 - entry) / (risk || 1);
            if (rr < 2) continue; 

            // Gap Check
            const gap = Math.abs(latest.open - prev.close);
            if (gap > atr14) continue; 

            // Calculate Data Integrity
            // Total score is out of 100.
            // If MAX_PAIN_MISSING -> Space score loses 5 pts
            // If STRIKES_DATA_MISSING -> OI score loses 20 pts
            // If OPTIONS_DATA_MISSING -> Total 25 pts lost
            let maxPossibleScore = 100;
            if (missingData.includes('OPTIONS_DATA_MISSING')) maxPossibleScore -= 25;
            else {
                if (missingData.includes('MAX_PAIN_MISSING')) maxPossibleScore -= 5;
                if (missingData.includes('STRIKES_DATA_MISSING')) maxPossibleScore -= 20;
            }

            // Hard Filter: Reject terrible setups (Adjusted for available data)
            // Instead of absolute 50, we use a percentage of available data.
            const scorePercentage = (totalScore / maxPossibleScore) * 100;
            if (scorePercentage < 50) continue;

            // Push Result
            results.push({
                symbol,
                close: latest.close,
                score: totalScore,
                maxPossibleScore, // Pass this to UI
                scorePercentage: Number(scorePercentage.toFixed(1)),
                missingData, // Pass warnings to UI
                entry,
                stopLoss: Number(stopLoss.toFixed(2)),
                target1: Number(target1.toFixed(2)),
                target2: Number((entry + (3 * risk)).toFixed(2)),
                target3: Number((entry + (4 * risk)).toFixed(2)),
                isBreakout,
                isPullback,
                grade: scorePercentage >= 80 ? 'A+' : scorePercentage >= 70 ? 'Tradable' : 'Ignore',
                details: {
                    oiScore,
                    breakoutScore,
                    volScore,
                    spaceScore,
                    rsScore,
                    mktScore
                }
            });
        }

        console.log(`[V4-Strategy] Scan complete. Found ${results.length} stocks.`);
        return results;
    }
}

module.exports = new V4InstitutionalStrategy();
