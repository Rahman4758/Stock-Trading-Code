const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const accumulationAnalyzer = require('../services/accumulationAnalyzer');


// GET /api/v1/analysis/:symbol
router.get('/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const stock = await Stock.findOne({ symbol });
        if (!stock) return res.status(404).json({ detail: 'Stock not found' });

        const analysisResult = await accumulationAnalyzer.calculateAccumulationScore(symbol);

        let recommendation = 'HOLD';
        if (analysisResult.score >= 85) recommendation = 'STRONG_BUY';
        else if (analysisResult.score >= 70) recommendation = 'BUY';
        else if (analysisResult.score < 40) recommendation = 'AVOID';

        res.json({
            symbol,
            name: stock.name,
            sector: stock.sector,
            accumulation_score: analysisResult,
            current_price: 0.0,
            recommendation,
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ detail: 'Error performing analysis' });
    }
});

module.exports = router;
