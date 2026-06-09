/**
 * footprint.js — HTTP adapter only.
 * All business logic lives in FootprintService.
 */
const express         = require('express');
const router          = express.Router();
const footprintService = require('../services/FootprintService');

// GET /api/v1/footprint/:symbol?days=90
router.get('/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const days   = parseInt(req.query.days) || 90;

        const data = await footprintService.buildFootprint(symbol, days);
        res.json(data);
    } catch (err) {
        console.error('[Footprint]', err.message);
        res.status(500).json({ error: 'Failed to fetch footprint data' });
    }
});

module.exports = router;
