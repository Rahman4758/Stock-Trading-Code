const mongoose = require('mongoose');

const BulkDealSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
        clientName: { type: String, required: true },
        institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
        dealType: { type: String, enum: ['BUY', 'SELL'], required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        dealValue: { type: Number, required: true }, // in paise
        clientCategory: { type: String, enum: ['FII', 'DII', 'PROPRIETARY', 'HNI'] },
        
        // Data source tracking
        isSynthetic: { type: Boolean, default: false },
        source: { type: String, enum: ['REAL_NSE', 'SYNTHETIC'], default: 'REAL_NSE' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('BulkDeal', BulkDealSchema);
