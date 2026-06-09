const mongoose = require('mongoose');

const JobCheckpointSchema = new mongoose.Schema(
    {
        jobName: { type: String, required: true, unique: true, index: true },
        status: { type: String, enum: ['IDLE', 'RUNNING', 'FAILED', 'COMPLETED'], default: 'IDLE' },
        lastCompletedItem: { type: String, default: null }, // e.g., 'RELIANCE'
        itemsProcessed: { type: Number, default: 0 },
        totalItems: { type: Number, default: 0 },
        error: { type: String, default: null },
        startedAt: { type: Date, default: null },
        updatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model('JobCheckpoint', JobCheckpointSchema);
