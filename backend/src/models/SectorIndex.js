const mongoose = require('mongoose');

const SectorIndexSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        indexName: { type: String, required: true, index: true }, // e.g. NIFTY_BANK, NIFTY_IT

        open: { type: Number },
        high: { type: Number },
        low: { type: Number },
        close: { type: Number },
        volume: { type: Number },

        // RS of this sector vs Nifty50
        rsVsNifty: { type: Number },
        rsTrend: { type: String, enum: ['STRENGTHENING', 'WEAKENING', 'NEUTRAL'], default: 'NEUTRAL' },
        rotationSignal: { type: String, enum: ['ROTATING_IN', 'ROTATING_OUT', 'NEUTRAL'], default: 'NEUTRAL' },
    },
    { timestamps: true }
);

SectorIndexSchema.index({ indexName: 1, date: -1 });

module.exports = mongoose.model('SectorIndex', SectorIndexSchema);
