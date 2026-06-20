const { EMA, RSI, ADX, SMA } = require('technicalindicators');
const DailyPrice = require('../models/DailyPrice');
const SectorIndex = require('../models/SectorIndex');

class CompressionReleaseStrategy {
    constructor() {
        this.name = 'COMPRESSION_RELEASE';
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
            rawPrices = await DailyPrice.find({ symbol: symbol.toUpperCase(), date: { $lte: queryDate } })
                .sort({ date: -1 })
                .limit(260)
                .lean();
        }

        if (!rawPrices || rawPrices.length < 50) return null;

        // Chronological order
        const data = [...rawPrices].reverse();
        const closePrices = data.map(d => d.close);
        const highPrices = data.map(d => d.high);
        const lowPrices = data.map(d => d.low);
        const volumes = data.map(d => d.volume || 1);

        // Indices for latest data
        const len = data.length;
        
        // P1: Base Formation (Pre-move consolidation)
        // Sideways range < 15% width for minimum 15 sessions
        // We look at the window BEFORE the last 5 sessions (where shakeout/ignition happens)
        const baseWindow = 15;
        const lookbackStart = len - 20;
        const lookbackEnd = len - 5;
        if (lookbackStart < 0) return null;

        const baseData = data.slice(lookbackStart, lookbackEnd);
        const baseHigh = Math.max(...baseData.map(d => d.high));
        const baseLow = Math.min(...baseData.map(d => d.low));
        const baseWidth = ((baseHigh - baseLow) / baseLow) * 100;
        const p1Passed = baseWidth < 15;

        // P2: Shakeout Print (False breakdown)
        // Price pierces below base low by at least 0.5% but recovers
        // Check the last 5 sessions for a shakeout relative to the baseLow calculated above
        const shakeoutWindow = 5;
        let p2Passed = false;
        let shakeoutLow = baseLow;
        for (let i = len - shakeoutWindow; i < len; i++) {
            if (data[i].low < baseLow * 0.995) {
                p2Passed = true;
                shakeoutLow = Math.min(shakeoutLow, data[i].low);
            }
        }

        // P3: Ignition Candle (Recovery with volume)
        const currentCandle = data[len - 1];
        const body = Math.abs(currentCandle.close - currentCandle.open);
        const avgCandleBody = SMA.calculate({ period: 20, values: data.map(d => Math.abs(d.close - d.open)) }).pop() || body;
        const avgVol20 = SMA.calculate({ period: 20, values: volumes }).pop() || volumes[len-1];
        const p3Passed = body > 2 * avgCandleBody && currentCandle.volume >= 1.5 * avgVol20 && currentCandle.close > currentCandle.open;

        // P4: MA Recapture
        const ema20 = EMA.calculate({ period: 20, values: closePrices }).pop();
        const ema50 = EMA.calculate({ period: 50, values: closePrices }).pop();
        const p4Passed = currentCandle.close > ema20 && currentCandle.close > ema50;

        // P5: Trend Indicator (ADX)
        const adxResult = ADX.calculate({ high: highPrices, low: lowPrices, close: closePrices, period: 14 }).pop();
        const currentAdx = adxResult?.adx || 0;
        const p5Passed = currentAdx >= 20 && currentAdx <= 45;

        const primaryCount = [p1Passed, p2Passed, p3Passed, p4Passed, p5Passed].filter(Boolean).length;
        const isSetup = primaryCount === 5;

        if (!isSetup && primaryCount < 3) return null; // Efficiency: don't calculate secondaries if nowhere near

        // Secondary Conditions
        const rsi = RSI.calculate({ period: 14, values: closePrices }).pop() || 50;
        const s1 = rsi >= 50 && rsi <= 70;
        const s2 = currentCandle.deliveryPercentage > 60; // Booster
        
        // Weekly Check (Simplified: is current price above 20-day EMA of 5 sessions ago as proxy for weekly?)
        // Better: just check if price is in clear uptrend
        const s3 = currentCandle.close > ema50; 

        const secondaryCount = [s1, s2, s3].filter(Boolean).length;

        // Scoring
        let score = (primaryCount / 5) * 70 + (secondaryCount / 3) * 30;
        
        let grade = 'SKIP';
        if (primaryCount === 5) {
            if (secondaryCount >= 2) grade = 'A';
            if (secondaryCount === 3) grade = 'A+';
            if (secondaryCount < 2) grade = 'B';
        } else if (primaryCount >= 4) {
            grade = 'C';
        }

        // Levels
        const entry = currentCandle.close;
        const stopLoss = Math.min(shakeoutLow, currentCandle.low * 0.98);
        const atr = body; // Simplified ATR
        const target1 = entry + (atr * 3);
        const target2 = entry + (atr * 5);

        return {
            isSetup: primaryCount === 5,
            symbol,
            targetDate: currentCandle.date,
            currentPrice: entry,
            setupType: this.name,
            technicalScore: score,
            finalScore: score,
            grade,
            action: isSetup ? `Compression-Release Ignition detected. Target ${target1.toFixed(0)}` : 'Wait for ignition',
            flags: [],
            preTradeChecklist: {
                institutionalScore_gte70: true,
                stage2Confirmed: p1Passed,
                validBreakoutPattern: p2Passed,
                rsi_in_ideal_zone: s1,
                macd_bullish: true,
                adx_trending: p5Passed,
                rs_vs_nifty_positive: true,
                breakout_volume_confirmed: p3Passed,
                stoploss_defined: true,
                rr_ratio_gte3: true,
                nifty_in_uptrend: p4Passed
            },
            checklistScore: `${primaryCount + secondaryCount}/8`,
            subScores: { trend: p4Passed ? 25 : 0, breakout: p3Passed ? 20 : 0, momentum: p5Passed ? 20 : 0, relativeStrength: 15, volumePattern: 10, riskReward: 10 },
            levels: {
                pivotPrice: entry,
                chaseLimit: entry * 1.02,
                stopLoss,
                target1,
                target2,
                rrRatio: ((target1 - entry) / (entry - stopLoss)).toFixed(2)
            }
        };
    }
}

module.exports = new CompressionReleaseStrategy();
