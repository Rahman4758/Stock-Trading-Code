const mongoose = require('mongoose');

const SectorStockSchema = new mongoose.Schema({
    sector_id: { type: String, required: true, index: true },
    symbol: { type: String, required: true, unique: true },
    name: { type: String },
    last_updated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SectorStock', SectorStockSchema);
