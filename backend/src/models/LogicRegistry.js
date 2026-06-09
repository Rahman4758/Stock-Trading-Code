const mongoose = require('mongoose');

const logicRegistrySchema = new mongoose.Schema({
  entry_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  date: {
    type: String, // YYYY-MM-DD for easy filtering
    required: true
  },
  time: {
    type: String // HH:MM IST
  },
  change_type: {
    type: String,
    enum: ['WEIGHT', 'THRESHOLD', 'RULE', 'UNIVERSE', 'CIRCUIT_BREAKER'],
    required: true
  },
  affected_agent: {
    type: String,
    required: true
  },
  affected_parameter: {
    type: String,
    required: true
  },
  old_value: {
    type: mongoose.Schema.Types.Mixed
  },
  new_value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  triggered_by: {
    type: String,
    required: true
  },
  evidence: {
    type: String
  },
  reasoning: {
    type: String,
    required: true
  },
  approved_by: {
    type: String
  },
  approval_date: {
    type: Date
  },
  approval_status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  impact_on_stock_selection: {
    type: String
  },
  rollback_condition: {
    type: String
  },
  related_trades: [{
    type: String // trade_ids
  }],
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LogicRegistry', logicRegistrySchema);
