const mongoose = require('mongoose');

const SectorPerformanceSchema = new mongoose.Schema({
    timeframe: { type: String, enum: ['1W', '1M', '3M', '6M'], required: true },
    sector_id: { type: String, required: true },
    data_points: [{
        date: Date,
        value: Number
    }], // Normalized values (base 100) with timestamps
    total_change: Number,
    date_range: {
        from: Date,
        to: Date
    },
    generated_at: { type: Date, default: Date.now }
});

SectorPerformanceSchema.index({ timeframe: 1, sector_id: 1 }, { unique: true });

module.exports = mongoose.model('SectorPerformance', SectorPerformanceSchema);
