const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema(
    {
        symbol: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
        name: { type: String, required: true },
        sector: { type: String, index: true },
        industry: { type: String },
        isin: { type: String },
        marketCap: { type: Number },       // in rupees
        lotSize: { type: Number },         // F&O lot size
        sectorIndex: { type: String, index: true }, // e.g. 'NIFTY_BANK', 'NIFTY_IT'
        indexCategory: { type: String, default: 'UNKNOWN' }, // 'FNO', 'NIFTY_NEXT_50', 'NIFTY_MIDCAP_150'
        isFno: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Stock', StockSchema);
