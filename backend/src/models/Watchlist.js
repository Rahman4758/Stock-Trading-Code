const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
    symbol: { type: String, required: true, unique: true, uppercase: true, index: true },
    companyName: { type: String, default: '' },
    addedFrom: { type: String, default: 'MANUAL' }, // DYNAMIC_MOMENTUM, CLASSIC_INSTITUTIONAL, NR7_COMPRESSION, COMPRESSION_RELEASE, MANUAL
    category: { type: String, default: 'General' }, // user-defined: Breakout, Pullback, Swing, etc.
    notes: { type: String, default: '' },
    
    // Portfolio Tracking
    isOwned: { type: Boolean, default: false },
    buyPrice: { type: Number, default: null },
    sellPrice: { type: Number, default: null }, // Target Price / Expected Sell Price
    stopLoss: { type: Number, default: null },
    quantity: { type: Number, default: null },
    buyDate: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Watchlist', watchlistSchema);
