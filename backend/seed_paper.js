const mongoose = require('mongoose');
const PaperPortfolioState = require('./src/models/paper/PaperPortfolioState');
const PaperTrade = require('./src/models/paper/PaperTrade');
const PaperSignal = require('./src/models/paper/PaperSignal');
require('dotenv').config();

const MONGO_URI = "mongodb://localhost:27017/antigravity";

const seed = async () => {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // 1. Reset/Create Portfolio State
    await PaperPortfolioState.deleteMany({});
    await PaperPortfolioState.create({
        starting_capital: 500000,
        current_cash: 412000,
        current_portfolio_value: 523242,
        total_realized_pnl: 23242,
        total_return_pct: 4.65,
        is_active: true
    });

    // 2. Add some historical Trades
    await PaperTrade.deleteMany({});
    await PaperTrade.create([
        {
            trade_id: "PT-SEED-01",
            signal_id: "SIG-001",
            symbol: "TCS",
            trade_type: "SWING",
            direction: "LONG",
            entry_date: new Date("2025-04-01"),
            exit_date: new Date("2025-04-08"),
            entry_price: 2436,
            exit_price: 2548,
            exit_type: "TARGET",
            qty_total: 82,
            allocated_capital: 199752,
            total_invested: 199752,
            total_pnl: 9184,
            pnl_pct: 4.60,
            conviction_score: 83,
            devil_score: 3,
            exit_reason: "T2 hit at ₹2548. Institutions exiting into Q4 result announcement."
        },
        {
            trade_id: "PT-SEED-02",
            signal_id: "SIG-002",
            symbol: "HDFCBANK",
            trade_type: "INTRADAY",
            direction: "LONG",
            entry_date: new Date("2025-04-03"),
            exit_date: new Date("2025-04-03"),
            entry_price: 1642,
            exit_price: 1628,
            exit_type: "SL_HIT",
            qty_total: 122,
            allocated_capital: 200324,
            total_invested: 200324,
            total_pnl: -1708,
            pnl_pct: -0.85,
            conviction_score: 74,
            devil_score: 5,
            exit_reason: "SL hit at ₹1628. Nifty reversed after 10:30 AM."
        }
    ]);

    // 3. Add some Signals
    await PaperSignal.deleteMany({});
    await PaperSignal.create([
        {
            signal_id: "SIG-003",
            symbol: "INFY",
            trade_type: "SWING",
            direction: "LONG",
            entry_price: 1478,
            sl_price: 1445,
            t1_price: 1530,
            t2_price: 1575,
            t3_price: 1620,
            conviction_score: 78,
            devil_score: 4,
            selection_status: "IN_PORTFOLIO",
            received_at: new Date()
        },
        {
            signal_id: "SIG-004",
            symbol: "RELIANCE",
            trade_type: "INTRADAY",
            direction: "SHORT",
            entry_price: 1290,
            sl_price: 1302,
            t1_price: 1275,
            t2_price: 1262,
            t3_price: 1248,
            conviction_score: 71,
            devil_score: 4,
            selection_status: "FILTERED_MAX_POSITIONS",
            filter_reason: "Maximum 3 positions already open",
            received_at: new Date()
        }
    ]);

    console.log("Seeding complete!");
    process.exit(0);
};

seed();
