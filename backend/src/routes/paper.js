const express = require('express');
const router = express.Router();
const PaperTradingService = require('../services/PaperTradingService');
const PaperPosition = require('../models/paper/PaperPosition');
const PaperTrade = require('../models/paper/PaperTrade');
const PaperSignal = require('../models/paper/PaperSignal');
const { PaperEquityCurve, PaperMonthlyStats } = require('../models/paper/PaperPerformance');
const PaperPortfolioState = require('../models/paper/PaperPortfolioState');

// GET /api/v1/paper/portfolio
router.get('/portfolio', async (req, res) => {
    try {
        const state = await PaperTradingService.getPortfolioState();
        const openPositions = await PaperPosition.find({ status: 'OPEN' }).sort({ createdAt: -1 }).lean();
        const recentlyClosed = await PaperTrade.find().sort({ exit_date: -1 }).limit(10).lean();

        res.json({
            state,
            openPositions,
            recentlyClosed
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/paper/trades
router.get('/trades', async (req, res) => {
    try {
        const { type, status, limit = 50, page = 1 } = req.query;
        const query = {};
        if (type && type !== 'ALL') query.trade_type = type;
        
        const trades = await PaperTrade.find(query)
            .sort({ exit_date: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        res.json(trades);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/paper/signals
router.get('/signals', async (req, res) => {
    try {
        const signals = await PaperSignal.find().sort({ received_at: -1 }).limit(50).lean();
        res.json(signals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/paper/performance/summary
router.get('/performance/summary', async (req, res) => {
    try {
        const state = await PaperTradingService.getPortfolioState();
        const allTrades = await PaperTrade.find().lean();
        
        const wins = allTrades.filter(t => t.total_pnl > 0);
        const losses = allTrades.filter(t => t.total_pnl <= 0);
        
        const winRate = allTrades.length > 0 ? (wins.length / allTrades.length) * 100 : 0;
        
        res.json({
            total_return_pct: state.total_return_pct,
            win_rate_pct: winRate,
            total_trades: allTrades.length,
            avg_win: wins.length > 0 ? wins.reduce((s, t) => s + t.total_pnl, 0) / wins.length : 0,
            avg_loss: losses.length > 0 ? losses.reduce((s, t) => s + Math.abs(t.total_pnl), 0) / losses.length : 0,
            best_trade: allTrades.length > 0 ? Math.max(...allTrades.map(t => t.total_pnl)) : 0,
            worst_trade: allTrades.length > 0 ? Math.min(...allTrades.map(t => t.total_pnl)) : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/paper/performance/charts
router.get('/performance/charts', async (req, res) => {
    try {
        const equityCurve = await PaperEquityCurve.find().sort({ date: 1 }).lean();
        const monthlyBars = await PaperMonthlyStats.find().sort({ month: 1 }).lean();
        
        // Fallback if empty
        if (equityCurve.length === 0) {
            equityCurve.push({ date: new Date().toISOString().split('T')[0], portfolio_value: 500000 });
        }

        res.json({
            equityCurve: equityCurve.map(e => ({ date: e.date, equity: e.portfolio_value })),
            monthlyBars: monthlyBars.map(m => ({ month: m.month, pnl: m.realized_pnl }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/paper/signal (Manual trigger for testing)
router.post('/signal', async (req, res) => {
    try {
        const result = await PaperTradingService.processSignal(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
