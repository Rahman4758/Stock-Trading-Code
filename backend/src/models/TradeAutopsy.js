const mongoose = require('mongoose');

const tradeAutopsySchema = new mongoose.Schema({
  trade_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradeJournal',
    required: true,
    index: true
  },
  outcome: {
    type: String,
    enum: ['WIN', 'LOSS', 'BREAKEVEN'],
    required: true
  },
  r_multiple: {
    type: Number,
    required: true
  },
  agent_performance: {
    oi_agent: {
      was_correct: Boolean,
      accuracy_this_trade: String,
      detail: String
    },
    delivery_agent: {
      was_correct: Boolean,
      accuracy_this_trade: String,
      detail: String
    },
    technical_agent: {
      was_correct: Boolean,
      accuracy_this_trade: String,
      detail: String
    },
    market_regime_agent: {
      was_correct: Boolean,
      detail: String
    },
    devils_advocate: {
      was_correct: Boolean,
      caught_the_risk: Boolean,
      detail: String
    }
  },
  root_cause: {
    type: String
  },
  missed_signal: {
    type: String
  },
  best_agent_this_trade: {
    type: String
  },
  worst_agent_this_trade: {
    type: String
  },
  weight_change_recommendation: {
    justified: { type: Boolean, default: false },
    trigger: { type: String, enum: ['PATTERN_BASED', 'SINGLE_TRADE'] },
    changes: [{
      agent: String,
      current_weight: Number,
      recommended_weight: Number,
      reason: String
    }]
  },
  registry_entry_id: {
    type: String // Links to LogicRegistry.entry_id if created
  },
  lesson: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TradeAutopsy', tradeAutopsySchema);
