const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  config_id: {
    type: String,
    default: 'current_weights',
    unique: true
  },
  weights: {
    fii_score_max: { type: Number, default: 25 },
    dii_score_max: { type: Number, default: 20 },
    pcr_score_max: { type: Number, default: 20 },
    deliv_score_max: { type: Number, default: 15 },
    fundamental_score_max: { type: Number, default: 10 }
  },
  thresholds: {
    scanner_min_confidence: { type: Number, default: 0.70 },
    da_reject_threshold: { type: Number, default: 7 },
    da_reduce_size_threshold: { type: Number, default: 6 }
  },
  pre_market_rules: {
    gap_up_cancel_pct: { type: Number, default: 1.8 },
    gap_down_cancel_pct: { type: Number, default: 1.5 },
    nifty_open_cancel_pct: { type: Number, default: 0.8 }
  },
  last_updated_by: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
