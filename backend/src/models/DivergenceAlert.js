const mongoose = require('mongoose');

const DivergenceAlertSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },

        alertType: {
            type: String,
            enum: [
                'BULLISH_DIVERGENCE',
                'BEARISH_DIVERGENCE',
                'ACCELERATING_ACCUMULATION',
                'DISTRIBUTION_AT_HIGHS',
            ],
            required: true,
        },

        severity: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
        message: { type: String },
        actionRecommendation: { type: String },
        expectedMove: { type: String }, // e.g. "Breakout within 5-15 days"
        confidence: { type: Number, min: 0, max: 100 },

        // For audit / replay
        metadata: { type: mongoose.Schema.Types.Mixed },

        // Has this alert been acted upon?
        acknowledged: { type: Boolean, default: false },
    },
    { timestamps: true }
);

DivergenceAlertSchema.index({ symbol: 1, date: -1 });
DivergenceAlertSchema.index({ date: -1, severity: 1 });

module.exports = mongoose.model('DivergenceAlert', DivergenceAlertSchema);
