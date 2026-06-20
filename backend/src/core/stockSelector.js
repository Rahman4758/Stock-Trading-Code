const Stock = require('../models/Stock');
const SmartMoneyScore = require('../models/SmartMoneyScore');
const MarketDataService = require('../services/MarketDataService');
const divergenceDetector = require('../services/divergenceDetector');

// Strategy Engine Registry
const engines = [
    new (require('../engines/InstitutionalEngine'))(),
    new (require('../engines/VolatilityEngine'))(),
    new (require('../engines/TrendEngine'))()
];

/**
 * StockSelector (Expert Refactor)
 * 
 * Orchestrates the scanning process by:
 * 1. Fetching a unified data snapshot for each stock via MarketDataService.
 * 2. Running a registry of independent strategy engines.
 * 3. Aggregating and persisting signals independently per strategy.
 */
class StockSelector {
    /**
     * Scan the entire active universe of stocks.
     * @param {Date} date - Optional date to scan. If null, uses the latest trading date.
     */
    async scanUniverse(date = null) {
        const stocks = await Stock.find({ isActive: true }).lean();
        const finalResults = [];

        // 1. Determine target date
        const queryDate = date ? new Date(date) : await MarketDataService.getLatestTradingDate();
        if (!queryDate) {
            console.error('[Selector] No market data found. Scanning aborted.');
            throw new Error('DATA_MISSING: No market data available to scan.');
        }

        if (stocks.length === 0) {
            console.warn(`[Selector] Market empty. No active stocks found to scan.`);
            return []; // "Market empty" (no active universe configured)
        }

        console.log(`[Selector] Starting universe scan for ${queryDate.toISOString().split('T')[0]}...`);

        // 2. Process all stocks in parallel batches
        const stockPromises = stocks.map(async (stock) => {
            try {
                // Fetch unified data snapshot (Price, OI, Flow, etc.)
                const snapshot = await MarketDataService.getSymbolSnapshot(stock.symbol, queryDate);
                
                // ATOMICITY CHECK: Ensure we have essential data components
                if (!snapshot || !snapshot.latestPrice) return;

                // Strict Rule: If delivery data is 0 or null, it's considered an incomplete sync
                // (Unless it's a very illiquid stock, but for institutional tracking we need this)
                if (snapshot.latestPrice.deliveryPct === undefined || snapshot.latestPrice.deliveryPct === null || snapshot.latestPrice.deliveryPct === 0) {
                    console.warn(`[Selector] Skipping ${stock.symbol} for ${queryDate.toISOString().split('T')[0]} - Missing Delivery Data.`);
                    return;
                }

                // 3. Run all registered engines independently
                for (const engine of engines) {
                    try {
                        const signal = await engine.analyze(snapshot);
                        if (signal) {
                            // Calculate streak and save
                            const enriched = await this._processSignal(signal, stock);
                            finalResults.push(enriched);
                        }
                    } catch (err) {
                        console.error(`[Selector] Engine ${engine.id} failed for ${stock.symbol}:`, err.message);
                    }
                }

                // Divergence detection (Still runs once per symbol)
                await divergenceDetector.detect(stock.symbol, queryDate);

            } catch (err) {
                console.error(`[Selector] Snapshot failed for ${stock.symbol}: ${err.message}`);
            }
        });

        await Promise.all(stockPromises);

        // 4. Deduplicate and Sort
        // If a stock triggers multiple engines, keep the highest scoring signal 
        // and aggregate the setup names.
        // First pass: extract the true institutional flow (compositeScore) from InstitutionalEngine
        const trueCompositeScores = new Map();
        for (const r of finalResults) {
            if (r.setupType === 'CLASSIC_INSTITUTIONAL' && r.compositeScore) {
                trueCompositeScores.set(r.symbol, r.compositeScore);
            }
        }

        const dedupedMap = new Map();
        for (const r of finalResults) {
            if (r.grade === 'SKIP') continue;
            
            // Ensure the true Institutional Flow is preserved regardless of winning strategy
            if (trueCompositeScores.has(r.symbol)) {
                r.compositeScore = trueCompositeScores.get(r.symbol);
            }
            if (!r.compositeScore) r.compositeScore = 0; // fallback

            const existing = dedupedMap.get(r.symbol);
            if (!existing || r.finalScore > existing.finalScore) {
                // If this is the new highest, carry over any previously seen setups
                const setups = existing ? new Set([...(existing.allSetups || [existing.setupType]), r.setupType]) : new Set([r.setupType]);
                r.allSetups = Array.from(setups);
                dedupedMap.set(r.symbol, r);
            } else if (existing) {
                // If it's not the highest, just add its setupType to the existing highest
                if (!existing.allSetups) existing.allSetups = [existing.setupType];
                if (!existing.allSetups.includes(r.setupType)) {
                    existing.allSetups.push(r.setupType);
                }
            }
        }

        const sortedResults = Array.from(dedupedMap.values())
            .sort((a, b) => b.finalScore - a.finalScore);

        const radarManager = require('../services/radarManager');
        await radarManager.processDailyRadar(sortedResults);

        console.log(`[Selector] Scan complete. Found ${sortedResults.length} high-integrity signals.`);
        return sortedResults;
    }

    /**
     * Internal: Handle streak tracking and persistence for a signal
     */
    async _processSignal(signal, stock) {
        let streakDays = 0;
        let streakGrade = null;

        // Streak tracking for A+/A signals
        if (signal.grade === 'A+' || signal.grade === 'A') {
            const lookbackDate = new Date(signal.date);
            lookbackDate.setDate(lookbackDate.getDate() - 10);

            const prevScore = await SmartMoneyScore.findOne({
                symbol: signal.symbol,
                setupType: signal.setupType,
                date: { $lt: signal.date, $gte: lookbackDate }
            }).sort({ date: -1 }).select('streakDays').lean();

            streakDays = prevScore ? (prevScore.streakDays || 0) + 1 : 1;
            streakGrade = signal.grade;
        }

        // PERSISTENCE: Save to DB (Unique per Symbol + Date + SetupType)
        await SmartMoneyScore.findOneAndUpdate(
            { 
                symbol: signal.symbol, 
                date: signal.date, 
                setupType: signal.setupType 
            },
            {
                $set: {
                    ...signal,
                    streakDays,
                    streakGrade,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        return { ...signal, streakDays, streakGrade };
    }
}

module.exports = new StockSelector();
