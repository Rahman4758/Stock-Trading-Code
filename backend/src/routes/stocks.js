const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const accumulationAnalyzer = require('../services/accumulationAnalyzer');

const ANALYSIS_URL = process.env.ANALYSIS_SERVICE_URL || null;

// GET /api/v1/stocks — list all active stocks
router.get('/', async (req, res) => {
    const { skip = 0, limit = 100 } = req.query;
    const stocks = await Stock.find({ isActive: true })
        .skip(Number(skip))
        .limit(Number(limit))
        .select('-__v');
    res.json(stocks);
});

// GET /api/v1/stocks/:symbol — stock detail
router.get('/:symbol', async (req, res) => {
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });
    if (!stock) return res.status(404).json({ detail: 'Stock not found' });
    res.json(stock);
});

// GET /api/v1/stocks/:symbol/analysis — full analysis via JS service
router.get('/:symbol/analysis', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const stock = await Stock.findOne({ symbol });
    if (!stock) return res.status(404).json({ detail: 'Stock not found' });

    const data = await accumulationAnalyzer.calculateAccumulationScore(symbol);
    
    // Fetch raw latest data for UI display
    const DailyPrice = require('../models/DailyPrice');
    const OiData = require('../models/OiData');
    
    const latestPrice = await DailyPrice.findOne({ symbol }).sort({ date: -1 }).lean();
    const latestOi = await OiData.findOne({ symbol }).sort({ date: -1 }).lean();

    data.rawData = {
        close: latestPrice?.close || 0,
        volume: latestPrice?.volume || 0,
        deliveryPct: latestPrice?.deliveryPct || 0,
        oiSignal: latestOi?.oiSignal || 'NEUTRAL',
        oiChangePct: latestOi?.oiChangePct || 0,
        futureOi: latestOi?.futureOi || 0
    };

    res.json(data);
});

module.exports = router;
