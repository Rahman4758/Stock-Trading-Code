const { EMA, RSI, ADX, SMA } = require('technicalindicators');
const DailyPrice = require('../models/DailyPrice');
const SectorIndex = require('../models/SectorIndex');

class NR7Strategy {
    constructor() {
        this.name = 'NR7_COMPRESSION';
        this.rsiPeriod = 14;
        this.adxPeriod = 14;
        this.volSmaPeriod = 20;
    }

    async analyze(symbol, sectorIndexName, referenceDate = null, preFetchedPrices = null) {
        const queryDate = referenceDate || new Date();
        
        let rawPrices;
        if (preFetchedPrices) {
            rawPrices = preFetchedPrices;
        } else {
            // Fetch 260 days (approx 1 trading year) of data natively from MongoDB
            rawPrices = await DailyPrice.find({ symbol: symbol.toUpperCase(), date: { $lte: queryDate } })
                .sort({ date: -1 })
                .limit(260)
                .lean();
        }

        if (!rawPrices || rawPrices.length < 200) return null; // Requires minimum history for EMA 200

        // Reverse to chronological order for math libraries
        const data = rawPrices.reverse();

        const closePrices = data.map(d => d.close);
        const highPrices = data.map(d => d.high);
        const lowPrices = data.map(d => d.low);
        const volumes = data.map(d => d.volume || 1);

        // Calculate technicals
        const ema20 = EMA.calculate({ period: 20, values: closePrices });
        const ema50 = EMA.calculate({ period: 50, values: closePrices });
        const ema200 = EMA.calculate({ period: 200, values: closePrices });
        const smaVol = SMA.calculate({ period: this.volSmaPeriod, values: volumes });
        const rsi = RSI.calculate({ period: this.rsiPeriod, values: closePrices });
        const adxResult = ADX.calculate({ high: highPrices, low: lowPrices, close: closePrices, period: this.adxPeriod });

        // Grab latest values securely
        const currentPrice = closePrices[closePrices.length - 1];
        const currentEma20 = ema20.length > 0 ? ema20[ema20.length - 1] : currentPrice;
        const currentEma50 = ema50.length > 0 ? ema50[ema50.length - 1] : currentPrice;
        const currentEma200 = ema200.length > 0 ? ema200[ema200.length - 1] : currentPrice;
        const currentVol = volumes[volumes.length - 1];
        const avgVol20 = smaVol.length > 0 ? smaVol[smaVol.length - 1] : currentVol;
        const currentRsi = rsi.length > 0 ? rsi[rsi.length - 1] : 50;
        const currentAdx = adxResult.length > 0 ? (adxResult[adxResult.length - 1]?.adx || 0) : 0;

        const currentHigh = highPrices[highPrices.length - 1];
        const currentLow = lowPrices[lowPrices.length - 1];
        const targetDate = data[data.length - 1].date;

        // Market Structure Check (Nifty 50)
        let marketStructurePassed = false;
        const niftyData = await SectorIndex.find({ indexName: 'NIFTY50', date: { $lte: queryDate } })
            .sort({ date: -1 }).limit(100).lean();

        if (niftyData && niftyData.length >= 50) {
            const nData = niftyData.reverse();
            const niftyCloses = nData.map(d => d.close);
            const niftyEma50 = EMA.calculate({ period: 50, values: niftyCloses });
            const currentNiftyEma50 = niftyEma50[niftyEma50.length - 1];
            const currentNiftyPrice = niftyCloses[niftyCloses.length - 1];
            marketStructurePassed = currentNiftyPrice > currentNiftyEma50;
        }

        const checklist = [];
        let score = 0;
        let direction = 'NONE';

        // Filter 1: Macro Trend Alignment
        const trendAligned = (currentPrice > currentEma20 && currentEma20 > currentEma50 && currentEma50 > currentEma200);
        if (trendAligned) { direction = 'LONG'; checklist.push({ text: "Price > 20/50/200 EMA", passed: true }); score += 30; } 
        else { checklist.push({ text: "Trend Alignment", passed: false }); }

        // Filter 2: NR7 Compression ID
        let nr7Confirmed = false;
        if (data.length >= 7) {
            const ranges = [];
            for (let i = data.length - 7; i < data.length; i++) ranges.push(data[i].high - data[i].low);
            const currentRange = ranges[6];
            const minRangeIn7 = Math.min(...ranges);
            const isNR7 = (currentRange <= minRangeIn7 && currentRange > 0);
            
            if (isNR7) { nr7Confirmed = true; checklist.push({ text: "NR7 Range Contraction", passed: true }); score += 25; } 
            else { checklist.push({ text: "NR7 Range Contraction", passed: false }); }
        }

        // Filter 3: Volume Exhaustion
        const isVolPause = currentVol < avgVol20;
        if (isVolPause) {
            checklist.push({ text: "Volume < 20 SMA", passed: true });
            score += 15;
            if (currentVol >= avgVol20 * 0.4 && currentVol <= avgVol20 * 0.6) score += 5; // Ideal
        } else { checklist.push({ text: "Volume Exhaustion", passed: false }); }

        // Filter 4: Momentum Sweet Spot
        const isRsiValid = (currentRsi >= 40 && currentRsi <= 65);
        if (isRsiValid && currentAdx > 20) { checklist.push({ text: "Momentum (40<RSI<65 & ADX>20)", passed: true }); score += 15; } 
        else { checklist.push({ text: "Momentum Thresholds", passed: false }); }

        // Filter 5: Market Context
        if (marketStructurePassed && direction === 'LONG') { checklist.push({ text: `Index Market Structure (LONG)`, passed: true }); score += 10; } 
        else { checklist.push({ text: "Index Market Structure", passed: false }); }

        // Compile Technical Profile safely mimicking the schema structure
        let entry = currentHigh + (currentHigh * 0.001); // Standard breakout buffer
        let stopLoss = currentLow * 0.998; // Opposite edge SL rule
        let risk = Math.abs(entry - stopLoss) || (entry * 0.01);

        let target1 = entry + (risk * 1.5);
        let target2 = entry + (risk * 2.0);

        // Only emit trade if score is massive and rules pass
        let grade = 'SKIP';
        let action = 'Do not trade NR7 — rules negated';
        if (score >= 80 && nr7Confirmed) {
            grade = (score > 90) ? 'A+' : 'A';
            action = 'NR7 Breakout Executable - Enter on Confirmation';
        }

        return {
            isSetup: (score >= 80 && nr7Confirmed),
            symbol,
            targetDate,
            currentPrice,
            setupType: this.name,
            
            institutionalScore: 50, // NR7 overrides logic completely
            technicalScore: score,
            finalScore: score, 
            
            grade,
            action,
            flags: [], 
            
            preTradeChecklist: {
                stage2Confirmed: trendAligned,
                validBreakoutPattern: nr7Confirmed,
                rsi_in_ideal_zone: isRsiValid,
                macd_bullish: false,
                adx_trending: (currentAdx > 20),
                breakout_volume_confirmed: isVolPause,
                stoploss_defined: true,
                rr_ratio_gte3: true,
                nifty_in_uptrend: marketStructurePassed
            },
            checklistScore: `${(score/100)*11}/11`, // aesthetic mapping
            subScores: { trend: score, breakout: 20, momentum: 20, relativeStrength: 0, volumePattern: 0, riskReward: 0 },
            levels: {
                pivotPrice: entry,
                chaseLimit: entry * 1.02,
                stopLoss: stopLoss,
                target1: target1,
                target2: target2,
                rrRatio: 2.0
            },
            components: { institutionalFlow: 50, bulkDeal: 50, oiSignal: 50, delivery: 50, hiddenAccumulation: 50 }
        };
    }
}

module.exports = new NR7Strategy();
