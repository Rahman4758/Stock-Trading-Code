const mongoose = require('mongoose');

/**
 * MacroData Model
 * Tracks global inter-market indicators for the Money Flow dashboard.
 */
const macroDataSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true,
        unique: true
    },
    // Commodities
    gold_price: { type: Number, default: 0 },   // XAU/USD
    brent_oil: { type: Number, default: 0 },    // Brent Crude
    
    // Currencies
    usd_inr: { type: Number, default: 0 },      // USD/INR
    dxy: { type: Number, default: 0 },          // US Dollar Index
    
    // Yields
    us10y: { type: Number, default: 0 },        // US 10Y Treasury Yield
    
    // Global Indices (Close)
    sp500: { type: Number, default: 0 },
    nasdaq: { type: Number, default: 0 },
    
    is_synthetic: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Index for efficient timeline fetching
macroDataSchema.index({ date: -1 });

module.exports = mongoose.model('MacroData', macroDataSchema);
