const mongoose = require('mongoose');

const dailySnapshotSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        index: true,
        uppercase: true,
        trim: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    fii_net_cr: {
        type: Number,
        default: 0
    },
    dii_net_cr: {
        type: Number,
        default: 0
    },
    fii_fno_net: {
        type: Number,
        default: 0
    },
    delivery_pct: {
        type: Number,
        default: 0
    },
    pcr: {
        type: Number,
        default: 0
    },
    oi_change_pct: {
        type: Number,
        default: 0
    },
    iv_atm: {
        type: Number,
        default: 0
    },
    close_price: {
        type: Number,
        default: 0
    },
    institutional_bias: {
        type: String,
        enum: ['bullish', 'bearish', 'neutral'],
        default: 'neutral'
    },
    conviction_score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Adding optional precomputed metrics to make fetching easier
    fii_trend_score: { type: Number, default: 0 },
    dii_trend_score: { type: Number, default: 0 },
    oi_pcr_score: { type: Number, default: 0 },
    deliv_score: { type: Number, default: 0 },
    fundamental_score: { type: Number, default: 0 },
    
    // Panel 4 UI fields
    volume_ratio: { type: Number, default: 0 },
    rsi: { type: Number, default: 0 },
    vwap_position: { type: String, default: "N/A" }
}, {
    timestamps: true
});

// Compound index to ensure uniqueness of symbol per day
dailySnapshotSchema.index({ symbol: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailySnapshot', dailySnapshotSchema);
