const mongoose = require('mongoose');

const paperPositionSchema = new mongoose.Schema({
    trade_id: { type: String, required: true, unique: true },
    signal_id: { type: String, required: true },
    symbol: { type: String, required: true },
    exchange: { type: String, default: 'NSE' },
    trade_type: { type: String, enum: ['INTRADAY', 'SWING'], required: true },
    direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    entry_date: { type: Date, default: Date.now },
    entry_price: { type: Number, required: true },
    initial_sl: { type: Number, required: true },
    current_sl: { type: Number, required: true },
    t1_price: { type: Number, required: true },
    t2_price: { type: Number, required: true },
    t3_price: { type: Number, required: true },
    qty_total: { type: Number, required: true },
    qty_remaining: { type: Number, required: true },
    qty_booked_t1: { type: Number, default: 0 },
    qty_booked_t2: { type: Number, default: 0 },
    allocated_capital: { type: Number, required: true },
    total_invested: { type: Number, required: true },
    conviction_score: { type: Number },
    devil_score: { type: Number },
    agent_signals: { type: Object }, // Snapshot of agent consensus
    realized_pnl: { type: Number, default: 0 },
    unrealized_pnl: { type: Number, default: 0 },
    booking_log: [{
        event: String,
        price: Number,
        qty: Number,
        pnl: Number,
        timestamp: { type: Date, default: Date.now },
        new_sl: Number
    }],
    last_price_update: { type: Number },
    last_price_time: { type: Date }
}, { timestamps: true });

paperPositionSchema.index({ symbol: 1 });
paperPositionSchema.index({ status: 1 });

module.exports = mongoose.model('PaperPosition', paperPositionSchema);
