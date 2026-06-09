const mongoose = require('mongoose');

const InstitutionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        category: { type: String, enum: ['FII', 'DII', 'PROPRIETARY', 'HNI'], index: true },
        tier: { type: Number, min: 1, max: 4, index: true }, // 1=Smart Money, 2=Institutional, 3=Passive, 4=Retail
        country: { type: String },

        // Performance tracking
        totalTrades: { type: Number, default: 0 },
        winningTrades: { type: Number, default: 0 },
        totalVolume: { type: Number, default: 0 },
        avgHoldingPeriodDays: { type: Number },

        // Classification
        strategyType: { type: String, enum: ['VALUE_INVESTOR', 'MOMENTUM_TRADER', 'LONG_TERM', 'MIXED'], default: 'MIXED' },
        entryStyle: { type: String, enum: ['DIP_BUYER', 'MOMENTUM', 'MIXED'], default: 'MIXED' },
        reliabilityScore: { type: Number, min: 0, max: 100, default: 50 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Institution', InstitutionSchema);
