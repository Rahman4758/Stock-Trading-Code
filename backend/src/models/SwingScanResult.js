const mongoose = require('mongoose');

const SwingScanResultSchema = new mongoose.Schema({
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    date: { type: Date, required: true, index: true },

    // ── Core Swing Score ────────────────────────────────────────────────
    swingScore: { type: Number, default: 0 }, // 0-100
    scoreBreakdown: {
        priceStructure: { type: Number, default: 0 },  // max 20
        oiStructure:    { type: Number, default: 0 },  // max 25
        delivery:       { type: Number, default: 0 },  // max 20
        volume:         { type: Number, default: 0 },  // max 15
        relativeStrength: { type: Number, default: 0 },// max 10
        riskReward:     { type: Number, default: 0 },  // max 10
    },

    // ── Stage Classification ───────────────────────────────────────────
    stage: { type: String, enum: ['1-Early', '1-Mid', '1-Late', '2-Fresh', '2-Ongoing', '2-Extended', '3-Topping', '4-Downtrend', 'Unknown'], default: 'Unknown' },
    federalBankSimilarity: { type: Number, default: 0 }, // out of 10

    // ── Action / Signal ────────────────────────────────────────────────
    action: { type: String, enum: ['BUY', 'WATCHLIST', 'AVOID'], default: 'AVOID' },
    entryType: { type: String, enum: ['PRE-BREAKOUT', 'BREAKOUT', 'PULLBACK', 'NONE'], default: 'NONE' },
    confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },

    // ── Trade Levels ──────────────────────────────────────────────────
    entryZone: { low: Number, high: Number },
    stopLoss: { type: Number },
    target1: { type: Number },
    target2: { type: Number },
    target3: { type: Number },
    rrRatio: { type: Number },
    holdingPeriodDays: { type: String }, // e.g. "10 to 20"

    // ── Smart Money Signals ───────────────────────────────────────────
    smartMoneySignal: { type: String, enum: ['ACCUMULATION', 'DISTRIBUTION', 'NEUTRAL'], default: 'NEUTRAL' },
    optionTrapAlert: { type: Boolean, default: false },
    institutionalActivity: { type: String, enum: ['ACCUMULATION', 'DISTRIBUTION', 'NEUTRAL'], default: 'NEUTRAL' },

    // ── Derived Data (for daily tracking updates) ─────────────────────
    currentPrice: { type: Number },
    trend: { type: String },
    deliveryPct: { type: Number },
    deliveryTrend5d: { type: String, enum: ['RISING', 'FLAT', 'FALLING'] },
    deliveryTrend10d: { type: String, enum: ['RISING', 'FLAT', 'FALLING'] },
    oiSignal: { type: String },
    pcr: { type: Number },
    pcrTrend: { type: String },
    rsVsNifty: { type: String, enum: ['OUTPERFORMING', 'UNDERPERFORMING'] },
    rsVsSector: { type: String, enum: ['OUTPERFORMING', 'UNDERPERFORMING'] },
    support: { type: Number },
    resistance: { type: Number },
    high52w: { type: Number },
    mostImportantReason: { type: String },
    redFlags: { type: String },

    // ── LLM Full Report ──────────────────────────────────────────────
    llmReport: { type: String, default: '' },

    // ── Portfolio Context ─────────────────────────────────────────────
    isPortfolioStock: { type: Boolean, default: false },
    portfolioMeta: {
        buyPrice: Number,
        quantity: Number,
        currentPnl: Number,
        currentPnlPct: Number,
    },

    // ── Daily Tracking ────────────────────────────────────────────────
    trackingHistory: [{
        date: Date,
        swingScore: Number,
        stage: String,
        deliveryPct: Number,
        oiSignal: String,
        keyDevelopment: String,
        action: String,
    }],

    // ── Filter Pass Record (for debugging/audit) ──────────────────────
    layer1Pass: { type: Boolean, default: false },
    layer2Pass: { type: Boolean, default: false },
    layer2Score: { type: Number }, // raw algo score before LLM

}, { timestamps: true });

SwingScanResultSchema.index({ symbol: 1, date: -1 }, { unique: true });
SwingScanResultSchema.index({ date: -1, swingScore: -1 });
SwingScanResultSchema.index({ date: -1, action: 1 });

module.exports = mongoose.model('SwingScanResult', SwingScanResultSchema);
