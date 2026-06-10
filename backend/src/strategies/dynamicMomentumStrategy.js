const DailyPrice = require('../models/DailyPrice');
const Stock = require('../models/Stock');
const SectorStock = require('../models/SectorStock');
const sectorRotationAnalyzer = require('../services/sectorRotationAnalyzer');

class DynamicMomentumStrategy {
    async scan(filters) {
        // Build query based on filters if possible, otherwise filter in-memory
        const activeStocks = await Stock.find({ isActive: true }).lean();
        const results = [];

        // Get Top Sectors
        const rotationData = await sectorRotationAnalyzer.getSectorRankings();
        const topSectors = new Set();
        if (rotationData && rotationData.leaders) {
            rotationData.leaders.slice(0, 4).forEach(s => topSectors.add(s.indexName));
        }

        const sectorMap = {};
        const allSectors = await SectorStock.find().lean();
        allSectors.forEach(s => sectorMap[s.symbol] = s.sector_id);

        for (const stock of activeStocks) {
            const symbol = stock.symbol;
            
            // We need at least 260 days of data to compute 50/200 DMAs and 52-week highs accurately
            const priceDocs = await DailyPrice.find({ symbol }).sort({ date: -1 }).limit(260).lean();
            if (priceDocs.length < 21) continue; // Minimum required for basic calculations

            const latest = priceDocs[0];
            const close = latest.close;

            // Calculate missing technicals on the fly since they might not be in DB
            // 1. SMAs
            const getSMA = (n) => priceDocs.length >= n ? priceDocs.slice(0, n).reduce((sum, p) => sum + p.close, 0) / n : null;
            const sma50 = latest.sma50 || getSMA(50);
            const sma200 = latest.sma200 || getSMA(200);

            // 2. 52-Week High
            let high52w = latest.high52w || 0;
            if (!high52w) {
                for (let i = 0; i < priceDocs.length; i++) {
                    if (priceDocs[i].high > high52w) high52w = priceDocs[i].high;
                }
            }

            // 3. OBV & CMF
            let obv = latest.obv || 0;
            let obv5DaysAgo = priceDocs[5]?.obv || 0;
            let cmf = latest.cmf || 0;
            
            if (!latest.obv) {
                // Calculate OBV
                let tempObv = 0;
                const revDocs = [...priceDocs].reverse(); // oldest first
                for (let i = 1; i < revDocs.length; i++) {
                    if (revDocs[i].close > revDocs[i - 1].close) tempObv += revDocs[i].volume;
                    else if (revDocs[i].close < revDocs[i - 1].close) tempObv -= revDocs[i].volume;
                    if (i === revDocs.length - 6) obv5DaysAgo = tempObv;
                    if (i === revDocs.length - 1) obv = tempObv;
                }

                // Calculate simple CMF approximation over 20 days
                let mfvSum = 0, volSum = 0;
                for (let i = 0; i < Math.min(20, priceDocs.length); i++) {
                    const doc = priceDocs[i];
                    if (doc.high !== doc.low) {
                        const clv = ((doc.close - doc.low) - (doc.high - doc.close)) / (doc.high - doc.low);
                        mfvSum += clv * doc.volume;
                    }
                    volSum += doc.volume;
                }
                cmf = volSum > 0 ? mfvSum / volSum : 0;
            }

            // 4. RSI (Approximate RSI 14)
            let rsi14 = latest.rsi14 || 50;
            if (!latest.rsi14 && priceDocs.length >= 15) {
                let gains = 0, losses = 0;
                for(let i = 1; i <= 14; i++) {
                    const diff = priceDocs[i-1].close - priceDocs[i].close; // priceDocs is newest first
                    if (diff > 0) gains += diff;
                    else losses -= diff;
                }
                const avgGain = gains / 14;
                const avgLoss = losses / 14;
                if (avgLoss === 0) rsi14 = 100;
                else {
                    const rs = avgGain / avgLoss;
                    rsi14 = 100 - (100 / (1 + rs));
                }
            }

            // Optional Filters
            if (filters.requireDailyRsi && rsi14 < 60) continue;
            if (filters.requireWeeklyRsi && (latest.rsiWeekly || 50) < 60) continue;

            // Calculate higher high & higher low (current 5-day swing > previous 5-day swing)
            if (filters.requireHigherHigh) {
                let maxH1 = 0, minL1 = Infinity;
                for (let i = 0; i < 5; i++) {
                    if (priceDocs[i].high > maxH1) maxH1 = priceDocs[i].high;
                    if (priceDocs[i].low < minL1) minL1 = priceDocs[i].low;
                }
                
                let maxH2 = 0, minL2 = Infinity;
                for (let i = 5; i < 10; i++) {
                    if (priceDocs[i].high > maxH2) maxH2 = priceDocs[i].high;
                    if (priceDocs[i].low < minL2) minL2 = priceDocs[i].low;
                }
                
                if (!(maxH1 > maxH2 && minL1 > minL2)) continue;
            }

            // Calculate Consolidation (Price range over last 10 days is within 5%)
            if (filters.requireConsolidation) {
                let maxC = 0, minC = Infinity;
                for (let i = 0; i < 10; i++) {
                    if (priceDocs[i].close > maxC) maxC = priceDocs[i].close;
                    if (priceDocs[i].close < minC) minC = priceDocs[i].close;
                }
                const rangePct = (maxC - minC) / minC;
                if (rangePct > 0.06) continue; // Not a tight consolidation
            }

            // ----------------------------------------------------
            // Calculate 10-Point Checklist
            // ----------------------------------------------------
            const checklist = {
                priceAbove50DMA: false,
                priceAbove200DMA: false,
                near52WHigh: false,
                rsStrong: false,
                obvRising: false,
                cmfPositive: false,
                deliveryIncreasing: false,
                volumeDrying: false,
                breakoutVolume: false,
                sectorStrong: false
            };

            let score = 0;

            // 1 & 2. DMAs
            if (sma50 && close > sma50) { checklist.priceAbove50DMA = true; score++; }
            if (sma200 && close > sma200) { checklist.priceAbove200DMA = true; score++; }

            // 3. Near 52-week high (Within 10% of high)
            if (high52w && close >= high52w * 0.90) { checklist.near52WHigh = true; score++; }

            // 4. RS Strong
            // (Assuming rsVsNifty > 0 means outperforming Nifty)
            if ((latest.rsVsNifty && latest.rsVsNifty > 0) || (priceDocs[0].close / priceDocs[20].close) > 1.02) { 
                checklist.rsStrong = true; score++; 
            }

            // 5. OBV Rising (Current OBV > OBV 5 days ago)
            if (obv > obv5DaysAgo) { checklist.obvRising = true; score++; }

            // 6. CMF Positive
            if (cmf > 0) { checklist.cmfPositive = true; score++; }

            // 7. Delivery Increasing (Current delivery > avg of prev 5 days)
            // If today's delivery data isn't published yet (0), fallback to yesterday's data
            const delivLatestIdx = (latest.deliveryPct === 0 && priceDocs[1]) ? 1 : 0;
            const currentDelivery = priceDocs[delivLatestIdx].deliveryPct || 0;
            
            let avgDelivPrev5 = 0;
            for (let i = delivLatestIdx + 1; i <= delivLatestIdx + 5; i++) {
                avgDelivPrev5 += (priceDocs[i].deliveryPct || 0);
            }
            avgDelivPrev5 /= 5;
            
            if (currentDelivery > avgDelivPrev5 && currentDelivery > 0) { 
                checklist.deliveryIncreasing = true; 
                score++; 
            }

            // 8. Volume Drying in Base (Avg Vol last 5 days < Avg Vol prev 15 days)
            let avgVol5 = 0, avgVol15 = 0;
            for (let i = 1; i <= 5; i++) avgVol5 += priceDocs[i].volume;
            avgVol5 /= 5;
            for (let i = 6; i <= 20; i++) avgVol15 += priceDocs[i].volume;
            avgVol15 /= 15;
            if (avgVol5 < avgVol15) { checklist.volumeDrying = true; score++; }

            // 9. Breakout Volume (Today's vol > 1.5 * AvgVol20)
            const avgVol20 = (avgVol5 * 5 + avgVol15 * 15) / 20;
            if (latest.volume > 1.5 * avgVol20) { checklist.breakoutVolume = true; score++; }

            // 10. Sector Strong
            const sector = sectorMap[symbol];
            if (topSectors.has(sector)) { checklist.sectorStrong = true; score++; }

            // Filter by strict checklist requirements
            if (filters.requirePriceAbove50DMA && !checklist.priceAbove50DMA) continue;
            if (filters.requirePriceAbove200DMA && !checklist.priceAbove200DMA) continue;
            if (filters.requireNear52WHigh && !checklist.near52WHigh) continue;
            if (filters.requireRsStrong && !checklist.rsStrong) continue;
            if (filters.requireObvRising && !checklist.obvRising) continue;
            if (filters.requireCmfPositive && !checklist.cmfPositive) continue;
            if (filters.requireDeliveryIncreasing && !checklist.deliveryIncreasing) continue;
            if (filters.requireVolumeDrying && !checklist.volumeDrying) continue;
            if (filters.requireBreakoutVolume && !checklist.breakoutVolume) continue;
            if (filters.requireSectorStrong && !checklist.sectorStrong) continue;

            // Filter by min Score
            const minScore = filters.minScore || 0;
            if (score >= minScore) {
                let grade = 'Ignore';
                if (score >= 8) grade = 'A+';
                else if (score >= 6) grade = 'Tradable';

                // Calculate recent swing low (lowest low in last 10 days)
                let recentSwingLow = Infinity;
                for (let i = 0; i < Math.min(10, priceDocs.length); i++) {
                    if (priceDocs[i].low < recentSwingLow) recentSwingLow = priceDocs[i].low;
                }

                results.push({
                    symbol,
                    close,
                    score,
                    grade,
                    checklist,
                    sector,
                    rsiDaily: rsi14,
                    rsiWeekly: latest.rsiWeekly,
                    cmf: cmf,
                    obv: obv,
                    volume: latest.volume,
                    sma50: sma50 || (close * 0.90), // fallback if SMA50 unavailable
                    recentSwingLow: recentSwingLow !== Infinity ? recentSwingLow : (close * 0.95)
                });
            }
        }

        // Sort by score descending
        return results.sort((a, b) => b.score - a.score);
    }
}

module.exports = new DynamicMomentumStrategy();
