const mongoose = require('mongoose');

const DailyPriceSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },

        open: { type: Number },
        high: { type: Number },
        low: { type: Number },
        close: { type: Number },
        volume: { type: Number },

        // Delivery Data
        deliveryQty: { type: Number },
        deliveryPct: { type: Number }, // 0-100

        // Pre-calculated Technical Indicators
        sma20: { type: Number },
        sma50: { type: Number },
        sma200: { type: Number },
        atr14: { type: Number }, // Average True Range (14-day)
        
        // Momentum Setup Indicators
        high52w: { type: Number },
        obv: { type: Number },
        cmf: { type: Number },
        rsi14: { type: Number },
        rsiWeekly: { type: Number },

        // Relative strength vs Nifty50
        rsVsNifty: { type: Number },
    },
    { timestamps: true }
);

// Compound unique index: one price record per symbol per date
DailyPriceSchema.index({ symbol: 1, date: 1 }, { unique: true });


module.exports = mongoose.model('DailyPrice', DailyPriceSchema);
