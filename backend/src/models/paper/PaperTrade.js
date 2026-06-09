const mongoose = require('mongoose');

const paperTradeSchema = new mongoose.Schema({
    trade_id: { type: String, required: true, unique: true },
    signal_id: { type: String, required: true },
    symbol: { type: String, required: true },
    trade_type: { type: String, required: true },
    direction: { type: String, required: true },
    entry_date: { type: Date, required: true },
    exit_date: { type: Date, required: true },
    entry_price: { type: Number, required: true },
    exit_price: { type: Number, required: true },
    exit_type: { type: String, required: true }, // TARGET_T3, SL_HIT, TIME_EXIT
    exit_reason: { type: String },
    qty_total: { type: Number, required: true },
    allocated_capital: { type: Number, required: true },
    total_invested: { type: Number, required: true },
    total_pnl: { type: Number, required: true },
    pnl_pct: { type: Number, required: true },
    r_multiple: { type: Number },
    conviction_score: { type: Number },
    devil_score: { type: Number },
    agent_signals: { type: Object },
    entry_reasoning: { type: String },
    devil_challenge_detail: { type: String },
    booking_log: { type: Array },
    autopsy: { type: String },
    holding_days: { type: Number },
    max_adverse_excursion: { type: Number },
    max_favorable_excursion: { type: Number }
}, { timestamps: true });

paperTradeSchema.index({ symbol: 1 });
paperTradeSchema.index({ entry_date: -1 });

module.exports = mongoose.model('PaperTrade', paperTradeSchema);
