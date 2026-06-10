const express  = require('express');
const router   = express.Router();
const SwingScanner    = require('../services/SwingScanner');
const SwingScanResult = require('../models/SwingScanResult');

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
        res.json({ success: true, ...result });
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
