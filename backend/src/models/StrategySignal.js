const mongoose = require('mongoose');

const StrategySignalSchema = new mongoose.Schema({
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    strategyName: { type: String, default: 'FEDERAL_BANK_SWING', index: true },
    entryDate: { type: Date, required: true, index: true },
    
    // Entry Parameters
    entryPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    target1: { type: Number, required: true },
    target2: { type: Number, required: true },
    target3: { type: Number },
    
    // Performance Tracking
    highestPrice: { type: Number },
    lowestPrice: { type: Number },
    maxReturnPct: { type: Number, default: 0 },
    minReturnPct: { type: Number, default: 0 },
    
    // State Tracking
    status: { 
        type: String, 
        enum: ['ACTIVE', 'T1_HIT', 'T2_HIT', 'T3_HIT', 'SL_HIT', 'CLOSED_MANUAL', 'TIME_EXIT'], 
        default: 'ACTIVE' 
    },
    statusHistory: [{
        status: String,
        date: Date,
        price: Number
    }],
    
    // Exit Details
    exitDate: { type: Date },
    exitPrice: { type: Number },
    finalPnL: { type: Number }, // percentage
    exitReason: { type: String }, // manual exit reason
    
    // Metadata
    algoScore: { type: Number },
    confidence: { type: String },

}, { timestamps: true });

// Prevent duplicate signals on the same day for the same strategy
StrategySignalSchema.index({ symbol: 1, strategyName: 1, entryDate: 1 }, { unique: true });

module.exports = mongoose.model('StrategySignal', StrategySignalSchema);
