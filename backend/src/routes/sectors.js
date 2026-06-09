const express = require('express');
const router = express.Router();
const SectorPerformance = require('../models/SectorPerformance');
const SectorStock = require('../models/SectorStock');
const SmartMoneyScore = require('../models/SmartMoneyScore');
const MoneyFlowSnapshot = require('../models/MoneyFlowSnapshot');
const DailyPrice = require('../models/DailyPrice');

// Helper to generate mock performance if DB is empty
const genMockPerf = (base, vol, n = 22) => {
    let v = 100;
    return Array.from({ length: n }, () => {
        v = v * (1 + (base / n + (Math.random() - 0.48) * vol) / 100);
        return +v.toFixed(3);
    });
};

/**
 * GET /api/sectors/performance?tf=1M
 */
router.get('/performance', async (req, res) => {
    const { tf = '1M' } = req.query;
    try {
        let performances = await SectorPerformance.find({ timeframe: tf }).lean();
        
        // If empty, trigger an update (Real-time healing)
        if (performances.length === 0) {
            const SectorRotationSystem = require('../systems/SectorRotationSystem');
            await SectorRotationSystem.updateAllTimeframes();
            performances = await SectorPerformance.find({ timeframe: tf }).lean();
        }

        const result = {
            timeframe: tf,
            sectors: {},
            generated_at: performances.length > 0 ? performances[0].generated_at : new Date()
        };

        performances.forEach(p => {
            result.sectors[p.sector_id] = { data: p.data_points, change: p.total_change };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/sectors/:id/stocks?tf=1M
 */
router.get('/:id/stocks', async (req, res) => {
    const { id } = req.params;
    const { tf = '1M' } = req.query;
    
    try {
        // Ensure constituents are initialized
        const count = await SectorStock.countDocuments({ sector_id: id });
        if (count === 0) {
            const SectorInitializer = require('../services/SectorInitializer');
            await SectorInitializer.init();
        }

        // 1. Get stocks for this sector
        const sectorStocks = await SectorStock.find({ sector_id: id }).lean();
        const symbols = sectorStocks.map(s => s.symbol);

        // 2. Fetch signals and conviction from SmartMoneyScore
        const latestScores = await SmartMoneyScore.aggregate([
            { $match: { symbol: { $in: symbols } } },
            { $sort: { date: -1 } },
            { $group: { _id: "$symbol", doc: { $first: "$$ROOT" } } }
        ]);

        const scoreMap = {};
        latestScores.forEach(s => scoreMap[s._id] = s.doc);

        // 3. Fetch Price and Performance using MarketDataService
        const MarketDataService = require('../services/MarketDataService');
        const latestDate = await MarketDataService.getLatestTradingDate();
        
        const timeframeDays = { '1W': 5, '1M': 22, '3M': 66, '6M': 132 };
        const days = timeframeDays[tf] || 22;

        const stocks = await Promise.all(sectorStocks.map(async (s) => {
            const score = scoreMap[s.symbol] || {};
            
            // Use MarketDataService for consistent data fetching
            const snapshot = await MarketDataService.getSymbolSnapshot(s.symbol, latestDate, { 
                priceDays: days, 
                flowDays: 1 
            });

            let price = 0;
            let change = 0;

            if (snapshot && snapshot.priceHistory && snapshot.priceHistory.length > 0) {
                const history = snapshot.priceHistory;
                price = history[0].close;
                const oldPrice = history[history.length - 1].close;
                change = ((price - oldPrice) / oldPrice) * 100;
            }

            return {
                symbol: s.symbol,
                name: s.name,
                price,
                change_1w: tf === '1W' ? change : 0,
                change_1m: tf === '1M' ? change : 0,
                change_3m: tf === '3M' ? change : 0,
                change_6m: tf === '6M' ? change : 0,
                signal: score.grade === 'A+' || score.grade === 'A' ? 'BUY' : score.grade === 'B' || score.grade === 'C' ? 'WATCH' : 'AVOID',
                conviction: score.finalScore || 0
            };
        }));

        // 4. Fetch SAA Status
        const SaaEngine = require('../services/SaaEngine');
        const saaStatus = await SaaEngine.getStatusForSector(id);

        res.json({
            sector_id: id,
            sector_saa_status: saaStatus.status,
            saa_message: saaStatus.message,
            stocks: stocks.sort((a, b) => b.conviction - a.conviction)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/sectors/saa-status
 */
router.get('/saa-status', async (req, res) => {
    try {
        const SaaEngine = require('../services/SaaEngine');
        const status = await SaaEngine.getAllSectorStatuses();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/sectors/rotation
 * Legacy support for Dashboard overview
 */
router.get('/rotation', async (req, res) => {
    try {
        const SectorIndex = require('../models/SectorIndex');
        const latestDate = await SectorIndex.findOne().sort({ date: -1 }).select('date');
        
        if (!latestDate) {
            return res.json({ leaders: [], laggards: [], all: [] });
        }

        const data = await SectorIndex.find({ date: latestDate.date }).sort({ rsVsNifty: -1 }).lean();
        
        const mapped = data.map(s => ({
            indexName: s.indexName,
            rsCurrent: s.rsVsNifty ? +s.rsVsNifty.toFixed(2) : 0,
            rsTrend: s.rsTrend === 'STRENGTHENING' ? 'Improving' : s.rsTrend === 'WEAKENING' ? 'Weakening' : 'Neutral',
            rotationSignal: s.rotationSignal || 'NEUTRAL',
            close: s.close
        }));

        res.json({
            leaders: mapped.slice(0, 3),
            laggards: [...mapped].reverse().slice(0, 3),
            all: mapped
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
