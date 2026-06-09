const mongoose = require('mongoose');

const SaaSignalSchema = new mongoose.Schema({
    eventType: { 
        type: String, 
        required: true,
        enum: ['TARIFF_IMPACT', 'GLOBAL_ROTATION', 'RBI_POLICY', 'FED_DECISION', 'SECTOR_CRASH', 'NORMAL_CLEARANCE'] 
    },
    affectedSectors: [{ type: String }], // Array of sector IDs like ['AUTO', 'METAL']
    severity: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
    status: { type: String, enum: ['BLOCKED', 'WATCH', 'CLEAR'], default: 'WATCH' },
    message: { type: String, required: true },
    detectedAt: { type: Date, default: Date.now },
    expiryDate: { type: Date }, // Optional: when this alert should expire
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

SaaSignalSchema.index({ isActive: 1, affectedSectors: 1 });

module.exports = mongoose.model('SaaSignal', SaaSignalSchema);
