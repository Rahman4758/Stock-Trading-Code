const express = require('express');
const router = express.Router();
const dynamicMomentumStrategy = require('../strategies/dynamicMomentumStrategy');

// POST /api/v1/vault/momentum-scan
// Allows custom filters for the momentum checklist strategy
router.post('/momentum-scan', async (req, res) => {
    try {
        const filters = {
            requireDailyRsi: req.body.requireDailyRsi || false,
            requireWeeklyRsi: req.body.requireWeeklyRsi || false,
            requireConsolidation: req.body.requireConsolidation || false,
            requireHigherHigh: req.body.requireHigherHigh || false,
            requirePriceAbove50DMA: req.body.requirePriceAbove50DMA || false,
            requirePriceAbove200DMA: req.body.requirePriceAbove200DMA || false,
            requireNear52WHigh: req.body.requireNear52WHigh || false,
            requireRsStrong: req.body.requireRsStrong || false,
            requireObvRising: req.body.requireObvRising || false,
            requireCmfPositive: req.body.requireCmfPositive || false,
            requireDeliveryIncreasing: req.body.requireDeliveryIncreasing || false,
            requireVolumeDrying: req.body.requireVolumeDrying || false,
            requireBreakoutVolume: req.body.requireBreakoutVolume || false,
            requireSectorStrong: req.body.requireSectorStrong || false,
            minScore: req.body.minScore || 0
        };

        const results = await dynamicMomentumStrategy.scan(filters);
        
        res.status(200).json({
            success: true,
            count: results.length,
            filtersApplied: filters,
            data: results
        });
    } catch (error) {
        console.error('[Vault] Error in dynamic momentum scan:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
