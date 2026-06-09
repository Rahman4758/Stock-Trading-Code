const DivergenceAlert = require('../models/DivergenceAlert');
const SmartMoneyScore = require('../models/SmartMoneyScore');
const DailyPrice = require('../models/DailyPrice');

class DivergenceDetector {
    /**
     * Run divergence detection for all active stocks (called by daily pipeline)
     */
    async detectDailyDivergences() {
        const Stock = require('../models/Stock');
        const DailyPrice = require('../models/DailyPrice');
        const stocks = await Stock.find({ isActive: true }).select('symbol').lean();
        
        // Anchor to latest available data date, not wall clock
        const latestPrice = await DailyPrice.findOne().sort({ date: -1 }).select('date').lean();
        const targetDate = latestPrice ? latestPrice.date : new Date();
        if (!latestPrice) {
            console.warn('[DivergenceDetector] No price data found, skipping.');
            return { alertsGenerated: 0, stocksChecked: 0 };
        }
        
        let alertsGenerated = 0;
        
        for (const stock of stocks) {
            try {
                const alerts = await this.detect(stock.symbol, targetDate);
                alertsGenerated += alerts.length;
            } catch (err) {
                // Skip stocks without enough data
            }
        }
        
        return { alertsGenerated, stocksChecked: stocks.length };
    }

    /**
     * Check for divergences between price action and institutional accumulation
     * Requires recent history of SmartMoneyScore and DailyPrice
     */
    async detect(symbol, targetDate) {
        // Fetch last 30 days of scores
        const endDate = new Date(targetDate);
        const startDate = new Date(targetDate);
        startDate.setDate(endDate.getDate() - 30);

        const scores = await SmartMoneyScore.find({
            symbol,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();

        const prices = await DailyPrice.find({
            symbol,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();

        if (scores.length < 3 || prices.length < 3) return []; // Reduced from 5 to 3 for better agility on new data

        const latestScore = scores[scores.length - 1];
        const oldestScore = scores[0];
        const latestPrice = prices[prices.length - 1];
        const oldestPrice = prices[0];

        const priceChange30d = ((latestPrice.close - oldestPrice.close) / oldestPrice.close) * 100;

        // Average scores over last 10 days vs previous 20 days
        const last10 = scores.slice(-10);
        const avgScore10d = last10.reduce((a, b) => a + b.compositeScore, 0) / (last10.length || 1);
        const avgScoreAll = scores.reduce((a, b) => a + b.compositeScore, 0) / (scores.length || 1);

        const alerts = [];

        // 1. Bullish Divergence: Heavy buying, but price is flat/down
        if (avgScore10d >= 60 && priceChange30d < 4) { // Lowered focus threshold to 60 for current regime
            alerts.push({
                symbol,
                date: targetDate,
                alertType: 'BULLISH_DIVERGENCE',
                severity: 'HIGH',
                message: `Heavy institutional buying (Score: ${avgScore10d.toFixed(0)}/100) but price is only up ${priceChange30d.toFixed(2)}%`,
                actionRecommendation: 'STRONG BUY - Accumulate before breakout',
                expectedMove: 'Breakout imminent within 5-15 days',
                confidence: 90
            });
        }

        // 2. Accelerating Accumulation
        if (avgScore10d > avgScoreAll + 12 && avgScore10d > 55) { // Lowered delta to 12% and base to 55
            alerts.push({
                symbol,
                date: targetDate,
                alertType: 'ACCELERATING_ACCUMULATION',
                severity: 'MEDIUM',
                message: `Institutional buying accelerating (Last 10d: ${avgScore10d.toFixed(0)} vs 30d: ${(avgScoreAll).toFixed(0)})`,
                actionRecommendation: 'BUY - Momentum building',
                expectedMove: 'Continued uptrend likely',
                confidence: 75
            });
        }

        // 3. Bearish Divergence / Distribution at Highs
        if (avgScore10d < 30 && priceChange30d > 10) {
            alerts.push({
                symbol,
                date: targetDate,
                alertType: 'DISTRIBUTION_AT_HIGHS',
                severity: 'HIGH',
                message: `Institutions distributing (Score: ${avgScore10d.toFixed(0)}/100) despite ${priceChange30d.toFixed(2)}% rally`,
                actionRecommendation: 'SELL/EXIT - Top formation likely',
                expectedMove: 'Reversal/correction within 7-20 days',
                confidence: 85
            });
        }

        // Save alerts to DB
        for (const alert of alerts) {
            await DivergenceAlert.findOneAndUpdate(
                { symbol: alert.symbol, date: alert.date, alertType: alert.alertType },
                { $set: alert },
                { upsert: true }
            );
        }

        return alerts;
    }
}

module.exports = new DivergenceDetector();
