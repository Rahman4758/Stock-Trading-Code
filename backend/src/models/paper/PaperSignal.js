const mongoose = require('mongoose');

const paperSignalSchema = new mongoose.Schema({
    signal_id: { type: String, required: true, unique: true },
    received_at: { type: Date, default: Date.now },
    symbol: { type: String, required: true },
    trade_type: { type: String, required: true },
    direction: { type: String, required: true },
    entry_price: { type: Number, required: true },
    sl_price: { type: Number, required: true },
    t1_price: { type: Number, required: true },
    t2_price: { type: Number, required: true },
    t3_price: { type: Number, required: true },
    conviction_score: { type: Number, required: true },
    devil_score: { type: Number, required: true },
    devil_recommendation: { type: String },
    agent_signals: { type: Object },
    entry_reasoning: { type: String },
    devil_challenge_detail: { type: String },
    selection_status: { 
        type: String, 
        enum: [
            'IN_PORTFOLIO', 
            'FILTERED_LOW_CONVICTION', 
            'FILTERED_DEVIL_REJECT', 
            'FILTERED_MAX_POSITIONS', 
            'FILTERED_SECTOR_CONCENTRATION', 
            'FILTERED_SAA_HIGH', 
            'FILTERED_STALE'
        ],
        required: true 
    },
    filter_reason: { type: String },
    linked_trade_id: { type: String },
    hypothetical_outcome: { type: String, enum: ['WIN', 'LOSS'] },
    hypothetical_pnl: { type: Number }
}, { timestamps: true });

paperSignalSchema.index({ symbol: 1 });
paperSignalSchema.index({ received_at: -1 });

module.exports = mongoose.model('PaperSignal', paperSignalSchema);
