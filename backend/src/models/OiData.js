const mongoose = require('mongoose');

const OiDataSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },

        // Futures OI
        futureOi: { type: Number },
        futureOiChange: { type: Number },
        futureOiChangePct: { type: Number },
        oiChangePct: { type: Number }, // Alias used by moneyFlowService and sector analytics

        // Options Aggregate
        callOi: { type: Number },
        putOi: { type: Number },
        pcr: { type: Number }, // Put-Call Ratio = putOi / callOi
        
        // Granular Option Chain Data (V4 Strategy)
        maxPain: { type: Number },
        topPutStrikes: [{
            strike: Number,
            oi: Number,
            oiChange: Number
        }],
        topCallStrikes: [{
            strike: Number,
            oi: Number,
            oiChange: Number
        }],

        // OI Signal Classification
        // LONG_BUILDUP: price↑ + OI↑
        // SHORT_BUILDUP: price↓ + OI↑
        // SHORT_COVERING: price↑ + OI↓
        // LONG_UNWINDING: price↓ + OI↓
        oiSignal: {
            type: String,
            enum: ['LONG_BUILDUP', 'SHORT_BUILDUP', 'SHORT_COVERING', 'LONG_UNWINDING', 'NEUTRAL'],
            default: 'NEUTRAL',
        },
        
        // Data source tracking
        isSynthetic: { type: Boolean, default: false },
        source: { type: String, enum: ['REAL_NSE', 'SYNTHETIC'], default: 'REAL_NSE' },
    },
    { timestamps: true }
);

// Compound unique index: one OI record per symbol per date
OiDataSchema.index({ symbol: 1, date: 1 }, { unique: true });


module.exports = mongoose.model('OiData', OiDataSchema);
