const mongoose = require('mongoose');

const tradeJournalSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        index: true,
        uppercase: true
    },
    sector: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['OPEN', 'CLOSED'],
        default: 'OPEN',
        index: true
    },
    entry_date: {
        type: Date,
        default: Date.now
    },
    exit_date: {
        type: Date
    },
    entry_price: {
        type: Number,
        required: true
    },
    exit_price: {
        type: Number
    },
    stop_loss: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    capital_deployed: {
        type: Number,
        required: true
    },
    risk_amount: {
        type: Number,
        required: true
    },
    pnl_absolute: {
        type: Number,
        default: 0
    },
    pnl_percentage: {
        type: Number,
        default: 0
    },
    event_type: {
        type: String
    },
    conviction_score_at_entry: {
        type: Number
    },
    notes: {
        type: String
    },
    trade_type: {
        type: String,
        enum: ['AUTO', 'MANUAL'],
        default: 'MANUAL'
    },
    strategy_name: {
        type: String
    },
    target1: {
        type: Number
    },
    target2: {
        type: Number
    },
    entry_reason: {
        type: String
    },
    exit_reason: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TradeJournal', tradeJournalSchema);
