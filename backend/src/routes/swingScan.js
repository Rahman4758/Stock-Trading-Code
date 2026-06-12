const express  = require('express');
const router   = express.Router();
const SwingScanner    = require('../services/SwingScanner');
const SwingScanResult = require('../models/SwingScanResult');
const StrategySignal  = require('../models/StrategySignal');

// POST /api/v1/swing-scan/run — Trigger full 3-layer scan
router.post('/run', async (req, res) => {
    try {
        console.log('[Route] /swing-scan/run triggered');
        const result = await SwingScanner.runFullScan();
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Route] /swing-scan/run error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/swing-scan/track-portfolio — Daily portfolio tracking update
router.post('/track-portfolio', async (req, res) => {
    try {
        const result = await SwingScanner.trackPortfolioStocks();
        const sigResult = await SwingScanner.trackStrategySignals();
        res.json({ success: true, portfolioUpdated: result.updated, signalsUpdated: sigResult.updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/swing-scan/results — Get latest scan results
router.get('/results', async (req, res) => {
    try {
        const { action, minScore, limit = 50 } = req.query;
        const query = {};
        if (action) query.action = action.toUpperCase();
        if (minScore) query.swingScore = { $gte: Number(minScore) };

        const results = await SwingScanResult.find(query)
            .sort({ swingScore: -1, date: -1 })
            .limit(Number(limit))
            .lean();

        // De-duplicate: keep the latest result per symbol
        const seen = new Set();
        const deduped = results.filter(r => {
            if (seen.has(r.symbol)) return false;
            seen.add(r.symbol);
            return true;
        });

        res.json({ success: true, count: deduped.length, data: deduped });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/swing-scan/signals-history — Get historical strategy performance
router.get('/signals-history', async (req, res) => {
    try {
        const strategy = req.query.strategy || 'FEDERAL_BANK_SWING';
        console.log(`[swingScan] signals-history requested for strategy: ${req.query.strategy} -> used: ${strategy}`);
        const signals = await StrategySignal.find({ strategyName: strategy })
            .sort({ entryDate: -1 })
            .lean();

        let wins = 0;
        let losses = 0;
        let totalReturn = 0;

        signals.forEach(sig => {
            if (['T1_HIT', 'T2_HIT', 'T3_HIT'].includes(sig.status)) wins++;
            if (sig.status === 'SL_HIT') losses++;
            if (sig.maxReturnPct) totalReturn += sig.maxReturnPct;
        });

        const completedTrades = wins + losses;
        const winRate = completedTrades > 0 ? (wins / completedTrades) * 100 : 0;
        const avgMaxReturn = signals.length > 0 ? (totalReturn / signals.length) : 0;

        res.json({ 
            success: true, 
            count: signals.length, 
            metrics: {
                totalSignals: signals.length,
                wins,
                losses,
                winRate: winRate.toFixed(1),
                avgMaxReturn: avgMaxReturn.toFixed(2),
                active: signals.length - completedTrades
            },
            data: signals 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/v1/swing-scan/signals-history/:id/exit — Manually exit a signal
router.post('/signals-history/:id/exit', async (req, res) => {
    try {
        const { id } = req.params;
        const { exitPrice, reason } = req.body;

        if (!exitPrice || isNaN(exitPrice)) {
            return res.status(400).json({ success: false, error: 'Valid exitPrice is required' });
        }

        const signal = await StrategySignal.findById(id);
        if (!signal) {
            return res.status(404).json({ success: false, error: 'Signal not found' });
        }

        const finalPnL = ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100;

        signal.status = 'CLOSED_MANUAL';
        signal.exitDate = new Date();
        signal.exitPrice = Number(exitPrice);
        signal.finalPnL = finalPnL;
        signal.exitReason = reason || 'Manual Exit';

        signal.statusHistory.push({
            status: 'CLOSED_MANUAL',
            date: new Date(),
            price: Number(exitPrice)
        });

        await signal.save();

        res.json({ success: true, data: signal });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/swing-scan/results/:symbol — Get detailed result for one stock
router.get('/results/:symbol', async (req, res) => {
    try {
        const result = await SwingScanResult.findOne({ symbol: req.params.symbol.toUpperCase() })
            .sort({ date: -1 }).lean();
        if (!result) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/v1/swing-scan/portfolio-stocks — All portfolio stocks with tracking history
router.get('/portfolio-stocks', async (req, res) => {
    try {
        const results = await SwingScanResult.find({ isPortfolioStock: true })
            .sort({ date: -1 })
            .lean();

        const seen = new Set();
        const deduped = results.filter(r => {
            if (seen.has(r.symbol)) return false;
            seen.add(r.symbol);
            return true;
        });

        res.json({ success: true, count: deduped.length, data: deduped });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
