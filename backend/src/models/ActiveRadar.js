const mongoose = require('mongoose');

const activeRadarSchema = new mongoose.Schema({
    symbol: { type: String, required: true, index: true },
    
    // Entry Metrics
    entryDate: { type: Date, default: Date.now },
    entryPrice: { type: Number, required: true },
    entryInstScore: { type: Number, required: true },
    entryTechScore: { type: Number, default: 0 },
    
    // Performance Tracking
    highestScore: { type: Number, default: 0 },
    highestPrice: { type: Number, default: 0 },
    daysOnRadar: { type: Number, default: 1 },
    
    // Technical Levels (from Entry)
    stopLoss: { type: Number },
    targetPrice: { type: Number },
    
    // State Machine
    status: { 
        type: String, 
        enum: ['TRACKING', 'EXITED_STOP_LOSS', 'EXITED_SCORE_DECAY', 'REPLACED', 'EXITED_MANUAL'], 
        default: 'TRACKING',
        index: true
    },
    
    // Exit Metrics
    exitDate: { type: Date },
    exitPrice: { type: Number },
    exitReason: { type: String }

}, { timestamps: true });

module.exports = mongoose.model('ActiveRadar', activeRadarSchema);
