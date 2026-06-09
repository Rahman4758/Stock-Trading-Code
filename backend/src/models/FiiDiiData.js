const mongoose = require('mongoose');

// Using a regular collection (MongoDB 7 Time Series requires different setup)
// Using regular collection with date index for easy querying
const FiiDiiDataSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },

        // FII Data (values in paise)
        fiiGrossBuy: { type: Number },
        fiiGrossSell: { type: Number },
        fiiNet: { type: Number },

        // DII Data (values in paise)
        diiGrossBuy: { type: Number },
        diiGrossSell: { type: Number },
        diiNet: { type: Number },

        // Combined
        combinedNet: { type: Number },

        // Rolling Averages
        fii5dayAvg: { type: Number },
        fii20dayAvg: { type: Number },
        dii5dayAvg: { type: Number },
        dii20dayAvg: { type: Number },
        
        // Data source tracking
        isSynthetic: { type: Boolean, default: false },
        source: { type: String, enum: ['REAL_NSE', 'SYNTHETIC'], default: 'REAL_NSE' },
    },
    { timestamps: true }
);

// Compound unique index: one record per symbol per date
FiiDiiDataSchema.index({ date: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('FiiDiiData', FiiDiiDataSchema);
