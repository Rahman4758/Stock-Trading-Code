const mongoose = require('mongoose');

const paperPortfolioStateSchema = new mongoose.Schema({
    starting_capital: { type: Number, default: 500000 },
    current_cash: { type: Number, default: 500000 },
    current_portfolio_value: { type: Number, default: 500000 },
    total_realized_pnl: { type: Number, default: 0 },
    total_unrealized_pnl: { type: Number, default: 0 },
    total_return_pct: { type: Number, default: 0 },
    max_positions_allowed: { type: Number, default: 3 },
    max_capital_per_position: { type: Number, default: 100000 },
    paper_trading_start_date: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true },
    last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PaperPortfolioState', paperPortfolioStateSchema);
