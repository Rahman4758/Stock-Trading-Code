const mongoose = require('mongoose');

const paperEquityCurveSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    portfolio_value: { type: Number, required: true },
    cash: { type: Number, required: true },
    daily_pnl: { type: Number, required: true },
    cumulative_pnl: { type: Number, required: true },
    drawdown_pct: { type: Number, required: true }
}, { timestamps: true });

const paperMonthlyStatsSchema = new mongoose.Schema({
    month: { type: String, required: true, unique: true }, // MMM-YYYY
    starting_capital: { type: Number, required: true },
    ending_capital: { type: Number, required: true },
    realized_pnl: { type: Number, required: true },
    win_rate_pct: { type: Number, required: true },
    total_trades: { type: Number, required: true },
    profit_factor: { type: Number, required: true }
}, { timestamps: true });

const PaperEquityCurve = mongoose.model('PaperEquityCurve', paperEquityCurveSchema);
const PaperMonthlyStats = mongoose.model('PaperMonthlyStats', paperMonthlyStatsSchema);

module.exports = { PaperEquityCurve, PaperMonthlyStats };
