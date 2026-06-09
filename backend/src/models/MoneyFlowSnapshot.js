const mongoose = require("mongoose");

const FiiDiiSnapshotSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    fii_buy: Number,
    fii_sell: Number,
    fii_net: Number,
    dii_buy: Number,
    dii_sell: Number,
    dii_net: Number,
    nifty_close: Number,
    banknifty_close: Number,
    india_vix: Number,
    usd_inr: Number,
  },
  { timestamps: true }
);

const SectorFlowSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    sector: { type: String, required: true, index: true },
    index_symbol: String,
    flow_cr: Number,
    rs_score: Number,
    delivery_pct: Number,
    oi_change_pct: Number,
    volume_vs_avg: Number,
    rotation_phase: String,
  },
  { timestamps: true }
);

const AssetFlowSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    asset: { type: String, required: true, index: true },
    price: Number,
    normalized_rs: Number,
    flow_30d_cr: Number,
    signal: String,
  },
  { timestamps: true }
);

const SmartMoneySignalSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    sms_score: Number,
    signal: String,
    delivery_pct: Number,
    volume_ratio: Number,
    vwap_position: String,
    rsi: Number,
    adx: Number,
    oi_trend: String,
    price: Number,
  },
  { timestamps: true }
);

const AlertSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    type: { type: String, required: true },
    severity: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
    message: String,
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = {
  FiiDiiSnapshot: mongoose.model("FiiDiiSnapshot", FiiDiiSnapshotSchema),
  SectorFlow: mongoose.model("SectorFlow", SectorFlowSchema),
  AssetFlow: mongoose.model("AssetFlow", AssetFlowSchema),
  SmartMoneySignal: mongoose.model("SmartMoneySignal", SmartMoneySignalSchema),
  MoneyFlowAlert: mongoose.model("MoneyFlowAlert", AlertSchema),
};
