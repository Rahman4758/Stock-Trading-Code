const express = require('express');
const router = express.Router();
const SmartMoneyScore = require('../models/SmartMoneyScore');
const DivergenceAlert = require('../models/DivergenceAlert');
const StockSelector = require('../core/stockSelector');
const DailyPrice = require('../models/DailyPrice');
const { redisClient } = require('../config/db');

// GET /api/v1/scan/latest
router.get('/latest', async (req, res) => {
    try {
        const cached = await redisClient.get('scan:latest');
        if (cached) return res.json(JSON.parse(cached));

        // Fetch latest saved scores from DB by checking SmartMoneyScore directly
        const latestScore = await SmartMoneyScore.findOne().sort({ date: -1 }).select('date').lean();
        if (!latestScore) return res.json([]);

        const strategy = req.query.strategy;
        const filter = { date: latestScore.date };
        if (strategy) filter.setupType = strategy;

        const rawScores = await SmartMoneyScore.find(filter)
            .sort({ finalScore: -1, compositeScore: -1 })
            .lean();

        // Deduplicate by symbol
        const uniqueScoresMap = new Map();
        for (const score of rawScores) {
            if (!uniqueScoresMap.has(score.symbol)) {
                uniqueScoresMap.set(score.symbol, score);
            }
        }
        const scores = Array.from(uniqueScoresMap.values()).slice(0, 50);

        const latestPriceDate = latestScore.date;

        // Enrich with current price data + all Technical Scoring fields
        const enriched = await Promise.all(scores.map(async (score) => {
            const price = await DailyPrice.findOne({ symbol: score.symbol, date: latestPriceDate }).lean();
            return {
                symbol: score.symbol,
                currentPrice: price ? price.close : 0,

                // Scores
                compositeScore: score.compositeScore,
                technicalScore: score.technicalScore,
                finalScore: score.finalScore || score.compositeScore,
                scores: score.scores,
                subScores: score.subScores,

                // Trade Info
                grade: score.grade || 'PENDING',
                action: score.action,
                setupType: score.setupType,
                flags: score.flags || [],

                // Details
                preTradeChecklist: score.preTradeChecklist,
                checklistScore: score.checklistScore,
                levels: {
                    pivotPrice: score.pivotPrice,
                    chaseLimit: score.chaseLimit,
                    stopLoss: score.stopLoss,
                    target1: score.target1,
                    target2: score.target2,
                    rrRatio: score.rrRatio,
                },

                // Legacy
                recommendation: score.interpretation,
                confidence: score.confidence,

                // Streak tracking
                streakDays: score.streakDays || 0,
                streakGrade: score.streakGrade || null,
            };
        }));

        try { await redisClient.setex('scan:latest', 300, JSON.stringify(enriched)); } catch (e) {
            console.warn('Redis Cache Set failed:', e.message);
        }

        res.json(enriched);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch latest scan' });
    }
});

// GET /api/v1/scan/all
router.get('/all', async (req, res) => {
    try {
        const cached = await redisClient.get('scan:all');
        if (cached) return res.json(JSON.parse(cached));

        // Fetch latest saved scores from DB by checking SmartMoneyScore directly
        const latestScore = await SmartMoneyScore.findOne().sort({ date: -1 }).select('date').lean();
        if (!latestScore) return res.json([]);

        const rawScores = await SmartMoneyScore.find({ date: latestScore.date })
            .sort({ finalScore: -1, compositeScore: -1 })
            .lean();

        // Deduplicate by symbol
        const uniqueScoresMap = new Map();
        for (const score of rawScores) {
            if (!uniqueScoresMap.has(score.symbol)) {
                uniqueScoresMap.set(score.symbol, score);
            }
        }
        const scores = Array.from(uniqueScoresMap.values());

        const latestPriceDate = latestScore.date;

        // Enrich with current price data + all Technical Scoring fields
        const enriched = await Promise.all(scores.map(async (score) => {
            const price = await DailyPrice.findOne({ symbol: score.symbol, date: latestPriceDate }).lean();
            return {
                symbol: score.symbol,
                currentPrice: price ? price.close : 0,

                // Scores
                compositeScore: score.compositeScore,
                technicalScore: score.technicalScore,
                finalScore: score.finalScore || score.compositeScore,
                scores: score.scores,
                subScores: score.subScores,

                // Trade Info
                grade: score.grade || 'PENDING',
                action: score.action,
                setupType: score.setupType,
                flags: score.flags || [],

                // Details
                preTradeChecklist: score.preTradeChecklist,
                checklistScore: score.checklistScore,
                levels: {
                    pivotPrice: score.pivotPrice,
                    chaseLimit: score.chaseLimit,
                    stopLoss: score.stopLoss,
                    target1: score.target1,
                    target2: score.target2,
                    rrRatio: score.rrRatio,
                },

                // Legacy
                recommendation: score.interpretation,
                confidence: score.confidence,

                // Streak tracking
                streakDays: score.streakDays || 0,
                streakGrade: score.streakGrade || null,
            };
        }));

        try { await redisClient.setex('scan:all', 300, JSON.stringify(enriched)); } catch (e) {
            console.warn('Redis Cache Set failed:', e.message);
        }

        res.json(enriched);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch all scan results' });
    }
});

// GET /api/v1/scan/divergences
router.get('/divergences', async (req, res) => {
    try {
        const severity = req.query.severity ? req.query.severity.toUpperCase() : null;
        
        const cacheKey = `scan:divergences:${severity || 'all'}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        // Define match stage for filters
        const matchStage = { acknowledged: false };
        if (severity) matchStage.severity = severity;

        // Aggregation to get only the LATEST alert per symbol/type combo
        const alerts = await DivergenceAlert.aggregate([
            { $match: matchStage },
            { $sort: { date: -1 } }, // Latest first
            {
                $group: {
                    _id: { symbol: "$symbol", alertType: "$alertType" },
                    latestAlert: { $first: "$$ROOT" } // Take the first doc (latest)
                }
            },
            { $replaceRoot: { newRoot: "$latestAlert" } }, // Promote back to root
            { $sort: { date: -1, severity: 1 } }, // Re-sort final results
            { $limit: 40 } // Plenty for the dashboard
        ]);

        try { await redisClient.setex(cacheKey, 300, JSON.stringify(alerts)); } catch {}

        res.json(alerts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch divergences' });
    }
});

// POST /api/v1/scan/run (Trigger manual pipeline run)
router.post('/run', async (req, res) => {
    try {
        const results = await StockSelector.scanUniverse();
        
        // Bust all caches across the node seamlessly now that a new scan finished.
        try {
            await redisClient.del('scan:latest');
            await redisClient.del('scan:all');
            await redisClient.del('radar:active');
            await redisClient.del('radar:history');
            
            const divKeys = await redisClient.keys('scan:divergences:*');
            if (divKeys && divKeys.length > 0) {
                await redisClient.del(divKeys);
            }
        } catch (e) { console.error('Cache clean error', e); }

        res.json({ message: 'Scan complete', count: results.length });
    } catch (err) {
        console.error(err);
        if (err.message && err.message.startsWith('DATA_MISSING')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Scan failed' });
    }
});

module.exports = router;
