const mongoose = require('mongoose');

const watchlistAnalysisSchema = new mongoose.Schema({
    symbol: { type: String, required: true, unique: true, uppercase: true, index: true },
    analyzedAt: { type: Date, default: Date.now },
    
    // Core Verdicts
    trend: { type: String, enum: ['Bullish', 'Neutral', 'Bearish'], default: 'Neutral' },
    institutionalActivity: { type: String, enum: ['Accumulation', 'Distribution', 'Neutral'], default: 'Neutral' },
    oiAnalysis: { type: String, enum: ['Bullish', 'Bearish', 'Neutral'], default: 'Neutral' },
    deliveryAnalysis: { type: String, enum: ['Bullish', 'Bearish', 'Neutral'], default: 'Neutral' },
    volumeAnalysis: { type: String, enum: ['Bullish', 'Bearish', 'Neutral'], default: 'Neutral' },
    sectorStrength: { type: String, enum: ['Strong', 'Average', 'Weak'], default: 'Average' },
    
    // Scores
    riskScore: { type: Number, min: 1, max: 10, default: 5 },
    convictionScore: { type: Number, min: 1, max: 10, default: 5 },
    confidence: { type: Number, min: 0, max: 100, default: 50 },
    
    // Action
    suggestedAction: { type: String, enum: ['Strong Buy', 'Buy', 'Accumulate', 'Hold', 'Reduce', 'Exit'], default: 'Hold' },
    expectedHoldingPeriod: { type: String, enum: ['1-3 Days', '1-2 Weeks', '1-3 Months', '3-12 Months'], default: '1-2 Weeks' },
    
    // Levels
    supportLevels: {
        level1: { type: Number, default: 0 },
        level2: { type: Number, default: 0 }
    },
    resistanceLevels: {
        level1: { type: Number, default: 0 },
        level2: { type: Number, default: 0 }
    },
    invalidationLevel: { type: Number, default: 0 },
    
    // AI Reasoning
    detailedReasoning: { type: String, default: '' },
    
    // True LLM AI Response & Tracking
    aiDetailedAnalysis: { type: String, default: '' },
    aiError: { type: String, default: '' },
    dailyChanges: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // Raw data for transparency
    rawData: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // Price snapshot at analysis time
    currentPrice: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('WatchlistAnalysis', watchlistAnalysisSchema);
