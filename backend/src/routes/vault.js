const express = require('express');
const router = express.Router();
const dynamicMomentumStrategy = require('../strategies/dynamicMomentumStrategy');
const StrategySignal = require('../models/StrategySignal');

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
        
        // Log 9 & 10 rank scores automatically
        const topResults = results.filter(r => r.score >= 9);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const r of topResults) {
            try {
                const exists = await StrategySignal.findOne({
                    symbol: r.symbol,
                    strategyName: 'DYNAMIC_MOMENTUM',
                    entryDate: { $gte: today }
                });
                
                if (!exists) {
                    // Stop Loss is the closer of (recent swing low) or (50 DMA), but at least 1% below current price.
                    const dynamicSL = Math.max(r.recentSwingLow || 0, r.sma50 || 0);
                    const safeSL = Math.min(r.close * 0.99, dynamicSL);

                    await StrategySignal.create({
                        symbol: r.symbol,
                        strategyName: 'DYNAMIC_MOMENTUM',
                        entryDate: new Date(),
                        entryPrice: r.close,
                        stopLoss: Number(safeSL.toFixed(2)),
                        target1: Number((r.close * 1.05).toFixed(2)),
                        target2: Number((r.close * 1.10).toFixed(2)),
                        target3: Number((r.close * 1.15).toFixed(2)),
                        highestPrice: r.close,
                        lowestPrice: r.close,
                        status: 'ACTIVE',
                        algoScore: r.score,
                        confidence: r.score === 10 ? 'HIGH' : 'MEDIUM'
                    });
                }
            } catch (err) {
                console.error(`[Vault] Failed to track momentum signal for ${r.symbol}:`, err.message);
            }
        }
        
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
// POST /api/v1/vault/v4-scan
router.post('/v4-scan', async (req, res) => {
    try {
        const v4InstitutionalStrategy = require('../strategies/v4InstitutionalStrategy');
        const results = await v4InstitutionalStrategy.scan();
        
        const topResults = results.filter(r => r.score >= 70);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const r of topResults) {
            try {
                const exists = await StrategySignal.findOne({
                    symbol: r.symbol,
                    strategyName: 'V4_INSTITUTIONAL',
                    entryDate: { $gte: today }
                });
                
                if (!exists) {
                    await StrategySignal.create({
                        symbol: r.symbol,
                        strategyName: 'V4_INSTITUTIONAL',
                        entryDate: new Date(),
                        entryPrice: r.entry,
                        stopLoss: r.stopLoss,
                        target1: r.target1,
                        target2: r.target2,
                        target3: r.target3,
                        highestPrice: r.close,
                        lowestPrice: r.close,
                        status: 'ACTIVE',
                        algoScore: r.score,
                        confidence: r.score >= 85 ? 'HIGH' : 'MEDIUM'
                    });
                }
            } catch (err) {
                console.error(`[Vault] Failed to track V4 signal for ${r.symbol}:`, err.message);
            }
        }
        
        res.status(200).json({
            success: true,
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error('[Vault] Error in V4 Institutional scan:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
