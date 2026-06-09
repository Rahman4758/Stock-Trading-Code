const mongoose = require('mongoose');

const PortfolioSchema = new mongoose.Schema(
    {
        symbol: { type: String, required: true, unique: true, uppercase: true, trim: true },
        buyPrice: { type: Number },    // Entry price
        quantity: { type: Number },    // Number of shares
        notes: { type: String },
        alertPrice: { type: Number },
        trade_type: { type: String, enum: ['WATCHLIST', 'MANUAL'], default: 'WATCHLIST' },
        targetPrice: { type: Number },
        stopLoss: { type: Number },
        entryReason: { type: String }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Portfolio', PortfolioSchema);
