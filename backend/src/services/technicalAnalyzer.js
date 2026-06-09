const DailyPrice = require('../models/DailyPrice');

class TechnicalAnalyzer {
    constructor() {
        this.indicators = {
            RSI: this._calculateRSI.bind(this),
            MACD: this._calculateMACD.bind(this),
            VPA: this._calculateVPA.bind(this),
            SUPERTREND: this._calculateSupertrend.bind(this),
            MA_ALIGNMENT: this._calculateMAAlignment.bind(this),
        };
    }

    /**
     * Run all registered technical indicators
     * @param {string} symbol - Stock symbol
     * @param {number} days - Number of days to look back
     */
    async evaluate(symbol, days = 200) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const priceDocs = await DailyPrice.find({
            symbol: symbol.toUpperCase(),
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();

        if (priceDocs.length < 50) return { compositeScore: 50, individualScores: {} }; // Not enough data

        const scores = {};
        let totalWeight = 0, sumScore = 0;

        // Weights
        const weights = { RSI: 1.0, MACD: 1.2, VPA: 1.5, SUPERTREND: 1.0, MA_ALIGNMENT: 0.8 };

        for (const [name, func] of Object.entries(this.indicators)) {
            const score = func(priceDocs);
            scores[name] = parseFloat(score.toFixed(2));
            const w = weights[name];
            sumScore += (score * w);
            totalWeight += w;
        }

        const composite = parseFloat((sumScore / totalWeight).toFixed(2));

        return {
            compositeScore: composite,
            individualScores: scores,
            interpretation: this._interpret(composite),
        };
    }

    _calculateRSI(docs, period = 14) {
        if (docs.length < period + 1) return 50;
        let gains = 0, losses = 0;

        for (let i = docs.length - period; i < docs.length; i++) {
            const change = docs[i].close - docs[i - 1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        // Score: 40-60 is sweet spot (80 pts). <30 oversold (bullish reversal). >70 overbought (bearish)
        if (rsi <= 30) return 80 + (30 - rsi);
        if (rsi < 40) return 60;
        if (rsi <= 60) return 80;
        if (rsi < 70) return 40;
        return Math.max(0, 100 - ((rsi - 70) * 2));
    }

    _calculateMACD(docs) {
        // Simplified scoring for MACD momentum
        // Real MACD requires EMA calculation which is complex for a mock. 
        // Using SMA crossover proxy for simplicity
        if (docs.length < 26) return 50;

        const closes = docs.map(d => d.close);
        const sma12 = closes.slice(-12).reduce((a, b) => a + b, 0) / 12;
        const sma26 = closes.slice(-26).reduce((a, b) => a + b, 0) / 26;

        const proxyHist = sma12 - sma26;
        const prev12 = closes.slice(-13, -1).reduce((a, b) => a + b, 0) / 12;
        const prev26 = closes.slice(-27, -1).reduce((a, b) => a + b, 0) / 26;
        const prevHist = prev12 - prev26;

        if (proxyHist > 0 && prevHist <= 0) return 100; // crossover
        if (proxyHist > 0 && proxyHist > prevHist) return 80; // accelerating
        if (proxyHist > 0 && proxyHist <= prevHist) return 60; // decelerating
        if (proxyHist <= 0 && prevHist > 0) return 0; // bear crossover
        if (proxyHist < 0 && proxyHist < prevHist) return 20; // bear accelerating
        return 40; // bear decelerating
    }

    _calculateVPA(docs) {
        if (docs.length < 20) return 50;

        let obv = 0;
        const obvArr = [0];

        for (let i = 1; i < docs.length; i++) {
            if (docs[i].close > docs[i - 1].close) obv += docs[i].volume;
            else if (docs[i].close < docs[i - 1].close) obv -= docs[i].volume;
            obvArr.push(obv);
        }

        const closeCurr = docs[docs.length - 1].close;
        const close20 = docs[docs.length - 20].close;
        const priceSlope = (closeCurr - close20) / close20;

        const obvCurr = obvArr[obvArr.length - 1];
        const obv20 = obvArr[obvArr.length - 20];
        const obvSlope = obv20 !== 0 ? (obvCurr - obv20) / Math.abs(obv20) : 0;

        if (priceSlope > 0.02 && obvSlope > 0) return 80; // Accumulation
        if (priceSlope < -0.02 && obvSlope > 0) return 95; // Hidden accumulation
        if (priceSlope > 0.02 && obvSlope <= 0) return 30; // Weak rally
        if (priceSlope < -0.02 && obvSlope < 0) return 10; // Distribution
        return 50;
    }

    _calculateSupertrend(docs) {
        if (docs.length < 2) return 50;
        const latest = docs[docs.length - 1];
        const prev = docs[docs.length - 2];

        // 10,3 supertrend mock based on price vs close
        if (latest.close > prev.close && latest.close > prev.high) return 80; // Bullish momentum
        if (latest.close < prev.close && latest.close < prev.low) return 20; // Bearish momentum
        return 50;
    }

    _calculateMAAlignment(docs) {
        const latest = docs[docs.length - 1];
        if (!latest) return 50;

        const { close, sma20, sma50, sma200 } = latest;
        let score = 50;

        if (sma20 && sma50 && sma200) {
            if (close > sma20 && sma20 > sma50 && sma50 > sma200) score = 100; // Perfect alignment
            else if (close > sma20 && sma20 > sma50) score = 80; // Medium-term bullish
            else if (close < sma20 && sma20 < sma50 && sma50 < sma200) score = 0; // Perfect bear
            else if (close < sma20) score = 30; // Short-term weak
        }

        return score;
    }

    _interpret(score) {
        if (score >= 80) return "STRONG BULLISH";
        if (score >= 60) return "BULLISH";
        if (score <= 20) return "STRONG BEARISH";
        if (score <= 40) return "BEARISH";
        return "NEUTRAL";
    }
}

module.exports = new TechnicalAnalyzer();
