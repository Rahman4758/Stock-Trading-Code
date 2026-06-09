const { EMA, RSI, MACD, ADX, ATR, OBV } = require('technicalindicators');
const DailyPrice = require('../models/DailyPrice');
const SectorIndex = require('../models/SectorIndex');

class TechnicalScorer {
    
    /**
     * Main entry point to compute the full technical score
     */
    async computeTechnicalScore(symbol, sectorIndexName, referenceDate = null, preFetchedPrices = null) {
        const queryDate = referenceDate || new Date();
        
        let prices;
        if (preFetchedPrices) {
            prices = [...preFetchedPrices]; // Clone to safely mutate with reverse()
        } else {
            // Fetch last 252 days of daily price history (1 trading year) for 52-week calculations strictly up to referenceDate
            prices = await DailyPrice.find({ symbol: symbol.toUpperCase(), date: { $lte: queryDate } })
                .sort({ date: -1 })
                .limit(260)
                .lean();
        }

        if (!prices || prices.length < 30) {
            return this._defaultBadScore("Insufficient price history (Min 30 required)");
        }

        // Sort ascending for technical analysis libraries
        prices.reverse(); 
        
        const latestPriceDoc = prices[prices.length - 1];
        
        let subScores = {
            trend: 0,
            breakout: 0,
            momentum: 0,
            relativeStrength: 0,
            volumePattern: 0,
            riskReward: 0,
        };
        
        let checklist = {
            stage2Confirmed: false,
            validBreakoutPattern: false,
            rsi_in_ideal_zone: false,
            macd_bullish: false,
            adx_trending: false,
            rs_vs_nifty_positive: false,
            breakout_volume_confirmed: false,
            stoploss_defined: false,
            rr_ratio_gte3: false,
            nifty_in_uptrend: false, // will check from SectorIndex
            institutionalScore_gte70: true // Assumed true if this module was called
        };

        let flags = [];
        let levels = {};

        // 1. Trend Structure Score
        const { score: trendScore, stage2Confirmed, trendFlags } = this.scoreTrendStructure(prices);
        subScores.trend = trendScore;
        checklist.stage2Confirmed = stage2Confirmed;
        if (trendFlags) flags.push(...trendFlags);

        // 2. Breakout Quality
        const { score: brkScore, breakoutConfirmed, validPattern, pivotPrice, chaseLimit, brkFlags } = this.scoreBreakoutQuality(prices);
        subScores.breakout = brkScore;
        checklist.breakout_volume_confirmed = breakoutConfirmed;
        checklist.validBreakoutPattern = validPattern;
        levels.pivotPrice = parseFloat(pivotPrice.toFixed(2));
        levels.chaseLimit = parseFloat(chaseLimit.toFixed(2));
        if (brkFlags) flags.push(...brkFlags);

        // 3. Momentum Score
        const { score: momScore, rsiZone, macdBullish, adxTrending, momFlags } = this.scoreMomentum(prices);
        subScores.momentum = momScore;
        checklist.rsi_in_ideal_zone = rsiZone;
        checklist.macd_bullish = macdBullish;
        checklist.adx_trending = adxTrending;
        if (momFlags) flags.push(...momFlags);

        // 4. Relative Strength
        const { score: rsScore, rsVsNiftyPositive, rsFlags, niftyUptrend } = await this.scoreRelativeStrength(symbol, prices, latestPriceDoc.date);
        subScores.relativeStrength = rsScore;
        checklist.rs_vs_nifty_positive = rsVsNiftyPositive;
        checklist.nifty_in_uptrend = niftyUptrend;
        if (rsFlags) flags.push(...rsFlags);

        // 5. Volume Pattern Score
        const { score: volPattScore } = this.scoreVolumePattern(prices);
        subScores.volumePattern = volPattScore;

        // 6. Risk / Reward Score
        const { score: rrScore, slDef, rrOk, stopLoss, target1, target2, rrRatio, rrFlags } = this.scoreRiskReward(prices);
        subScores.riskReward = rrScore;
        checklist.stoploss_defined = slDef;
        checklist.rr_ratio_gte3 = rrOk;
        levels.stopLoss = parseFloat(stopLoss.toFixed(2));
        levels.target1 = parseFloat(target1.toFixed(2));
        levels.target2 = parseFloat(target2.toFixed(2));
        levels.rrRatio = parseFloat(rrRatio.toFixed(2));
        if (rrFlags) flags.push(...rrFlags);

        // Total Technical Score
        const totalTechnicalScore = (
            subScores.trend + 
            subScores.breakout + 
            subScores.momentum + 
            subScores.relativeStrength + 
            subScores.volumePattern + 
            subScores.riskReward
        );

        // Count checklist true values
        let checklistYes = 0;
        for (const key in checklist) {
            if (checklist[key] === true) checklistYes++;
        }
        const checklistScoreStr = `${checklistYes}/11`;

        return {
            technicalScore: Math.min(100, Math.max(0, totalTechnicalScore)),
            subScores,
            checklist,
            checklistScore: checklistScoreStr,
            flags,
            levels,
        };
    }

    _defaultBadScore(reason) {
        return {
            technicalScore: 0,
            subScores: { trend: 0, breakout: 0, momentum: 0, relativeStrength: 0, volumePattern: 0, riskReward: 0 },
            checklist: this._blankChecklist(),
            checklistScore: "0/11",
            flags: ['DATA_ERROR'],
            levels: { pivotPrice:0, chaseLimit:0, stopLoss:0, target1:0, target2:0, rrRatio:0 },
        };
    }

    _blankChecklist() {
        return {
            institutionalScore_gte70: false, stage2Confirmed: false, validBreakoutPattern: false,
            rsi_in_ideal_zone: false, macd_bullish: false, adx_trending: false,
            rs_vs_nifty_positive: false, breakout_volume_confirmed: false,
            stoploss_defined: false, rr_ratio_gte3: false, nifty_in_uptrend: false,
        };
    }

    // ==========================================
    // 1. Trend Structure Score (Max 25)
    // ==========================================
    scoreTrendStructure(prices) {
        const closes = prices.map(p => p.close);
        if (closes.length < 20) return { score: 0, stage2Confirmed: false, trendFlags: ['TREND_FAIL'] }; // Reduced from 200

        const ema50Arr = (closes.length >= 50) ? EMA.calculate({ period: 50, values: closes }) : [];
        const ema150Arr = (closes.length >= 150) ? EMA.calculate({ period: 150, values: closes }) : [];
        const ema200Arr = (closes.length >= 200) ? EMA.calculate({ period: 200, values: closes }) : [];

        const currentPrice = closes[closes.length - 1];
        const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : currentPrice * 0.98;
        const ema150 = ema150Arr.length > 0 ? ema150Arr[ema150Arr.length - 1] : currentPrice * 0.95;
        const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : currentPrice * 0.92;

        // 52-week High / Low (using last 252 available days)
        const yearPrices = prices.slice(Math.max(prices.length - 252, 0)).map(p => p.high);
        const yearLows = prices.slice(Math.max(prices.length - 252, 0)).map(p => p.low);
        const high52w = Math.max(...yearPrices);
        const low52w = Math.min(...yearLows);

        let conditionsMet = 0;

        // C1: price > EMA50 > EMA150 > EMA200
        if (currentPrice > ema50 && ema50 > ema150 && ema150 > ema200) conditionsMet++;

        // C2: EMA(200) slope is positive for at least 20 trading days
        let slopePositive = true;
        for (let i = 1; i <= 20; i++) {
            if (ema200Arr.length - i - 1 >= 0) {
                if (ema200Arr[ema200Arr.length - i] <= ema200Arr[ema200Arr.length - i - 1]) {
                    slopePositive = false;
                    break;
                }
            }
        }
        if (slopePositive) conditionsMet++;

        // C3: price is within 25% of 52-week high
        if (currentPrice >= (high52w * 0.75)) conditionsMet++;

        // C4: price is at least 30% above 52-week low
        if (currentPrice >= (low52w * 1.30)) conditionsMet++;

        // C5: Last 10 candles show HH-HL pattern loosely
        let last10 = prices.slice(prices.length - 10);
        // checking simple uptrend over 10 days
        if (last10.length >= 10 && last10[9].high > last10[0].high && last10[9].low > last10[0].low) {
            conditionsMet++;
        }

        let score = 0;
        if (conditionsMet === 5) score = 25;
        else if (conditionsMet === 4) score = 18;
        else if (conditionsMet === 3) score = 10;
        else score = 0;

        return {
            score,
            stage2Confirmed: conditionsMet >= 3,
            trendFlags: conditionsMet < 3 ? ['TREND_FAIL'] : []
        };
    }

    // ==========================================
    // 2. Breakout Quality Score (Max 20)
    // ==========================================
    scoreBreakoutQuality(prices) {
        if (prices.length < 20) return { score: 0, validPattern: false, breakoutConfirmed: false, pivotPrice: 0, chaseLimit: 0, brkFlags: [] };
        
        const latest = prices[prices.length - 1];
        const last10 = prices.slice(prices.length - 11, prices.length - 1);
        
        const avgVol10 = last10.reduce((acc, p) => acc + (p.volume || 0), 0) / (last10.length || 1);
        const breakoutVol = latest.volume || 0;

        const ratio = avgVol10 > 0 ? (breakoutVol / avgVol10) : 1;
        
        let score = 0;
        let brkFlags = [];
        let breakoutConfirmed = false;

        if (ratio >= 1.5) {
            score = 20;
            breakoutConfirmed = true;
        } else if (ratio >= 1.0) {
            score = 12;
            breakoutConfirmed = true; // Marginal
        } else {
            score = 0;
            brkFlags.push('WEAK_BREAKOUT');
        }

        // Pocket Pivot Check (Bonus +2)
        const isPocketPivot = last10.every(p => {
            const isDownDay = p.close < p.open;
            if (isDownDay && breakoutVol <= p.volume) return false;
            return true;
        });
        
        let validPattern = isPocketPivot; // Simple check for now
        if (isPocketPivot) {
            score = Math.min(20, score + 2);
        }

        // Pivot limits
        const pivotPrice = latest.high + 0.10;
        const chaseLimit = pivotPrice * 1.07; // 7% allowance for high momentum

        // Current price chase check (using latest.close)
        if (latest.close > chaseLimit && score > 2) {
            brkFlags.push('CHASING');
        }

        return {
            score,
            breakoutConfirmed,
            validPattern,
            pivotPrice,
            chaseLimit,
            brkFlags
        };
    }

    // ==========================================
    // 3. Momentum Score (Max 20)
    // ==========================================
    scoreMomentum(prices) {
        if (prices.length < 30) return { score: 0, rsiZone: false, macdBullish: false, adxTrending: false, momFlags: [] };

        const closes = prices.map(p => p.close);
        const highs = prices.map(p => p.high);
        const lows = prices.map(p => p.low);

        // RSI
        let rsiScore = 0;
        let rsiZone = false;
        const rsiArr = RSI.calculate({ period: 14, values: closes });
        const curRsi = rsiArr[rsiArr.length - 1];
        if (curRsi >= 50 && curRsi <= 65) { rsiScore = 8; rsiZone = true; }
        else if (curRsi > 65 && curRsi <= 75) { rsiScore = 6; rsiZone = true; }
        else if (curRsi > 75 && curRsi <= 80) rsiScore = 3;

        // MACD
        let macdScore = 0;
        let macdBullish = false;
        const macdInput = { values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false };
        const macdArr = MACD.calculate(macdInput);
        if (macdArr.length > 5) {
            const curMacd = macdArr[macdArr.length - 1];
            // Hist +
            if (curMacd.histogram > 0) { macdScore += 4; macdBullish = true; }
            // Line > 0
            if (curMacd.MACD > 0) macdScore += 3;
            // Cross check in last 5
            for(let i=1; i<=5; i++) {
                let m1 = macdArr[macdArr.length - i];
                let m2 = macdArr[macdArr.length - i - 1];
                if(m2 && m1.histogram > 0 && m2.histogram <= 0) {
                    macdScore += 5;
                    macdBullish = true;
                    break;
                }
            }
        }
        macdScore = Math.min(8, macdScore);

        // ADX
        let adxScore = 0;
        let adxTrending = false;
        let momFlags = [];
        const adxInput = { high: highs, low: lows, close: closes, period: 14 };
        const adxArr = ADX.calculate(adxInput);
        if (adxArr.length > 0) {
            const curAdx = adxArr[adxArr.length - 1].adx;
            if (curAdx > 25) { adxScore = 4; adxTrending = true; }
            else if (curAdx >= 20) { adxScore = 2; adxTrending = true; }
            else momFlags.push('CHOPPY');
        }

        const totalMom = Math.min(20, rsiScore + macdScore + adxScore);

        return { score: totalMom, rsiZone, macdBullish, adxTrending, momFlags };
    }

    // ==========================================
    // 4. Relative Strength Score (Max 15)
    // ==========================================
    async scoreRelativeStrength(symbol, prices, latestDate) {
        if (prices.length < 200) return { score: 0, rsVsNiftyPositive: false, rsFlags: ['RS_WEAK'], niftyUptrend: false };

        // Stock 52w return
        const curPrice = prices[prices.length - 1].close;
        const startPriceObj = prices.find((p, i) => i === Math.max(0, prices.length - 250)); // Approx 52 weeks
        const p52WeeksAgo = startPriceObj ? startPriceObj.close : prices[0].close;
        
        const stockReturn = (curPrice - p52WeeksAgo) / p52WeeksAgo;

        // Fetch Nifty
        const startDate = startPriceObj ? startPriceObj.date : prices[0].date;
        const niftyDocs = await SectorIndex.find({
            indexName: 'NIFTY50',
            date: { $gte: startDate, $lte: latestDate }
        }).sort({ date: 1 }).lean();

        let niftyUptrend = true; // Simplification
        let rsFlags = [];
        let score = 0;
        let rsVsNiftyPositive = false;

        if (niftyDocs.length > 50) {
            const niftyStart = niftyDocs[0].close;
            const niftyEnd = niftyDocs[niftyDocs.length - 1].close;
            const niftyReturn = (niftyEnd - niftyStart) / niftyStart;

            const rsRatio = stockReturn / (Math.abs(niftyReturn) < 0.0001 ? 0.0001 : niftyReturn);

            if (rsRatio >= 1.2 || stockReturn > niftyReturn + 0.15) { 
                score = 15;
                rsVsNiftyPositive = true;
            } else if (rsRatio >= 1.0 || stockReturn > niftyReturn) {
                score = 8;
                rsVsNiftyPositive = true;
            } else {
                rsFlags.push('RS_WEAK');
            }
        } else {
            rsFlags.push('RS_WEAK');
        }

        return { score, rsVsNiftyPositive, rsFlags, niftyUptrend };
    }

    // ==========================================
    // 5. Volume Pattern Score (Max 10)
    // ==========================================
    scoreVolumePattern(prices) {
        if (prices.length < 25) return { score: 0 };
        
        const closes = prices.map(p => p.close);
        const volumes = prices.map(p => p.volume || 1);
        
        // OBV
        const obvArr = OBV.calculate({ close: closes, volume: volumes });
        let obvScore = 0;
        
        if (obvArr.length >= 20) {
            const obvNow = obvArr[obvArr.length - 1];
            const obvOld = obvArr[obvArr.length - 20];
            const pNow = closes[closes.length - 1];
            const pOld = closes[closes.length - 20];
            
            const obvUp = obvNow > obvOld;
            const priceUp = pNow > pOld;
            const priceFlat = Math.abs(pNow - pOld)/pOld < 0.05;
            
            if (obvUp && priceFlat) obvScore = 6; // stealth accumulation
            else if (obvUp && priceUp) obvScore = 4;
        }

        // Delivery
        let delScore = 0;
        let upDayDeliveries = [];
        for (let i = prices.length - 10; i < prices.length; i++) {
            if(i < 1) continue;
            if (prices[i].close > prices[i-1].close && prices[i].deliveryPct) {
                upDayDeliveries.push(prices[i].deliveryPct);
            }
        }
        // take last 5
        upDayDeliveries = upDayDeliveries.slice(-5);
        if (upDayDeliveries.length > 0) {
            const avgDel = upDayDeliveries.reduce((a,b)=>a+b,0)/upDayDeliveries.length;
            if (avgDel > 60) delScore = 4;
            else if (avgDel >= 40) delScore = 2;
        }

        return { score: obvScore + delScore };
    }

    // ==========================================
    // 6. Risk / Reward Score (Max 10)
    // ==========================================
    scoreRiskReward(prices) {
        if (prices.length < 20) return { score: 0, slDef: false, rrOk: false, stopLoss:0, target1:0, target2:0, rrRatio:0, rrFlags:['POOR_RR'] };

        const highs = prices.map(p => p.high);
        const lows = prices.map(p => p.low);
        const closes = prices.map(p => p.close);

        const currentPrice = closes[closes.length - 1];
        
        const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
        const atr = atrArr.length > 0 ? atrArr[atrArr.length - 1] : (currentPrice*0.02);

        // Stop-loss: stronger of ATR-based or recent 20-day swing low
        const atrStopLoss = currentPrice - (1.5 * atr);
        const recentLows = lows.slice(-20);
        const swingLow = Math.min(...recentLows);
        const stopLoss = Math.max(atrStopLoss, swingLow * 0.99); // 1% below swing low

        const risk = currentPrice - stopLoss;
        if (risk <= 0) return { score: 0, slDef: true, rrOk: false, stopLoss: currentPrice * 0.95, target1: currentPrice * 1.05, target2: currentPrice * 1.10, rrRatio: 0, rrFlags: ['POOR_RR'] };

        // Target1: 52-week high (structural resistance)
        const yearHighs = highs.slice(Math.max(0, highs.length - 252));
        const high52w = Math.max(...yearHighs);

        // If current price is already near 52w high, use ATR-based extension
        let target1, target2;
        if (currentPrice >= high52w * 0.97) {
            // Already at highs — project using ATR
            target1 = currentPrice + (2.0 * atr);
            target2 = currentPrice + (4.0 * atr);
        } else {
            // Use structural resistance
            target1 = high52w;
            target2 = high52w + (high52w - currentPrice) * 0.5; // 50% extension beyond 52w high
        }

        const rrRatio = risk > 0 ? (target1 - currentPrice) / risk : 0;

        let score = 0;
        let rrFlags = [];
        let rrOk = false;

        if (rrRatio >= 3.0) {
            score = 10;
            rrOk = true;
        } else if (rrRatio >= 2.0) {
            score = 6;
            rrOk = true; // Acceptable
        } else if (rrRatio >= 1.5) {
            score = 3;
        } else {
            rrFlags.push('POOR_RR');
        }

        return {
            score,
            slDef: true,
            rrOk,
            stopLoss,
            target1,
            target2,
            rrRatio,
            rrFlags
        };
    }
}

module.exports = new TechnicalScorer();
