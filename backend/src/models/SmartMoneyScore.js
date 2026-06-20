const mongoose = require('mongoose');

const SmartMoneyScoreSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true, index: true },

        // Existing Institutional Component Scores (0-100 each)
        scores: {
            institutionalFlow: { type: Number },
            bulkDeal: { type: Number },
            oiSignal: { type: Number },
            delivery: { type: Number },
            hiddenAccumulation: { type: Number },
        },

        // Old 'compositeScore' gets aliased/renamed conceptually, but backward compat
        compositeScore: { type: Number, required: true }, // This is the InstitutionalScore
        
        // New Technical Scoring Layer Fields
        technicalScore: { type: Number }, // 0-100 (if InstScore >= 70)
        finalScore: { type: Number }, // (Inst * 0.6) + (Tech * 0.4)
        
        // Trade Designation
        setupType: { type: String, enum: ['CLASSIC_INSTITUTIONAL', 'NR7_COMPRESSION', 'COMPRESSION_RELEASE'], default: 'CLASSIC_INSTITUTIONAL' },
        grade: { type: String, enum: ['A+', 'A', 'B', 'C', 'SKIP', 'PENDING'], default: 'PENDING' },
        action: { type: String }, // User-facing action string "Half position...", etc.
        flags: [{ type: String }], // Array of warning flags e.g., 'TREND_FAIL', 'RS_WEAK'
        
        // Trade Levels (Calculated by Breakout/Risk functions)
        pivotPrice: { type: Number },
        chaseLimit: { type: Number },
        stopLoss: { type: Number },
        target1: { type: Number },
        target2: { type: Number },
        rrRatio: { type: Number },
        
        // Checklist Booleans
        preTradeChecklist: {
            institutionalScore_gte70: { type: Boolean, default: false },
            stage2Confirmed: { type: Boolean, default: false },
            validBreakoutPattern: { type: Boolean, default: false },
            rsi_in_ideal_zone: { type: Boolean, default: false },
            macd_bullish: { type: Boolean, default: false },
            adx_trending: { type: Boolean, default: false },
            rs_vs_nifty_positive: { type: Boolean, default: false },
            breakout_volume_confirmed: { type: Boolean, default: false },
            stoploss_defined: { type: Boolean, default: false },
            rr_ratio_gte3: { type: Boolean, default: false },
            nifty_in_uptrend: { type: Boolean, default: false },
        },
        checklistScore: { type: String }, // e.g. "10/11"
        
        // Technical Sub-Scores Breakdown
        subScores: {
            trend: { type: Number },             // max 25
            breakout: { type: Number },          // max 20
            momentum: { type: Number },          // max 20
            relativeStrength: { type: Number },  // max 15
            volumePattern: { type: Number },     // max 10
            riskReward: { type: Number },        // max 10
        },

        // Exit Monitoring System
        exitMonitoring: {
            stopLoss: { type: Number },
            target1: { type: Number },
            target2: { type: Number },
            breakeven: { type: Number },
            status: { 
                type: String, 
                enum: ['OPEN', 'CLOSED_SL', 'CLOSED_T1', 'CLOSED_T2', 'CLOSED_DIST', 'CLOSED_EMA_BREAK', 'CLOSED_OI_REV', 'UNTRACKED'],
                default: 'UNTRACKED' 
            }
        },

        // Consecutive Grade Streak Tracking
        streakDays: { type: Number, default: 0 },   // How many consecutive days at A+ or A
        streakGrade: { type: String },               // The grade being streaked ('A+' or 'A')

        // Legacy Interpretation
        interpretation: { type: String },
        confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },

        // For debugging / audit trail
        metadata: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

SmartMoneyScoreSchema.index({ symbol: 1, date: -1, setupType: 1 }, { unique: true });
SmartMoneyScoreSchema.index({ symbol: 1, date: -1 });
SmartMoneyScoreSchema.index({ date: -1, finalScore: -1 });
SmartMoneyScoreSchema.index({ date: -1, compositeScore: -1 });
SmartMoneyScoreSchema.index({ 'exitMonitoring.status': 1 });

module.exports = mongoose.model('SmartMoneyScore', SmartMoneyScoreSchema);
