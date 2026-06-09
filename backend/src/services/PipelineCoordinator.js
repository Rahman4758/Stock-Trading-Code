const DataSourceManager = require('../collectors/dataSourceManager');
const SectorCollector = require('../collectors/sectorCollector');
const EventScanner = require('../collectors/eventScanner');
const StockSelector = require('../core/stockSelector');
const MarketDataService = require('./MarketDataService');
const SectorRotationSystem = require('../systems/SectorRotationSystem');
const MacroCollector = require('../collectors/MacroCollector');
const deliveryService = require('./deliveryIntegrityService');
const marketFiiDii = require('../collectors/marketFiiDii');
const marketCalendar = require('./MarketCalendar');
const DailyPrice = require('../models/DailyPrice');
const SmartMoneyScore = require('../models/SmartMoneyScore');
const Stock = require('../models/Stock');
const WatchlistAnalyzer = require('./WatchlistAnalyzer');

/**
 * PipelineCoordinator
 * 
 * Atomic Multi-Day Pipeline:
 *   1. Finds the LAST FULLY COMPLETE date in DB (price + delivery + analysis all present)
 *   2. Computes every missing trading day from that date until today
 *   3. Bulk-fetches raw data (prices, OI, delivery, FII/DII, sectors, macro)
 *   4. Day-by-day: verifies data completeness → runs analysis → logs result
 *   5. Skips any day where critical data is missing (atomicity rule)
 */
class PipelineCoordinator {

    /**
     * Find the last date where data is FULLY COMPLETE:
     *   - At least 20 stocks have DailyPrice with deliveryPct > 0
     *   - At least 1 SmartMoneyScore analysis exists
     * 
     * Walks backwards from the latest price date until it finds a complete day.
     * Returns YYYY-MM-DD string or null if no complete day exists.
     */
    async _findLastCompleteDate() {
        // Get the last 30 distinct dates with price data
        const recentDates = await DailyPrice.aggregate([
            { $sort: { date: -1 } },
            { $group: { _id: '$date' } },
            { $sort: { _id: -1 } },
            { $limit: 30 }
        ]);

        if (recentDates.length === 0) return null;

        for (const { _id: date } of recentDates) {
            const dateObj = new Date(date);
            dateObj.setUTCHours(12, 0, 0, 0);
            const dateStr = dateObj.toISOString().split('T')[0];

            // Skip non-trading days that somehow got into DB
            if (!marketCalendar.isTradingDay(dateStr)) continue;

            // Check 1: Enough stocks with valid delivery data
            const deliveryCount = await DailyPrice.countDocuments({
                date: dateObj,
                deliveryPct: { $exists: true, $gt: 0 }
            });

            if (deliveryCount < 20) {
                console.log(`[Orchestrator] Date ${dateStr}: Incomplete — only ${deliveryCount} stocks with delivery data.`);
                continue;
            }

            // Check 2: Analysis was actually run for this date
            const analysisCount = await SmartMoneyScore.countDocuments({
                date: dateObj
            });

            if (analysisCount === 0) {
                console.log(`[Orchestrator] Date ${dateStr}: Incomplete — no SmartMoneyScore analysis found.`);
                continue;
            }

            console.log(`[Orchestrator] Last COMPLETE date: ${dateStr} (${deliveryCount} delivery, ${analysisCount} analyses)`);
            return dateStr;
        }

        // No complete date found in recent 30 — fall back to earliest
        console.warn('[Orchestrator] No fully complete date found in last 30 entries. Starting from scratch.');
        return null;
    }

    /**
     * Run the full daily data and analysis pipeline.
     * Automatically detects gaps and fills them day-by-day with atomicity checks.
     */
    async runFullPipeline(options = { source: 'upstox', days: null }) {
        console.log('\n[Orchestrator] ══════════════════════════════════════════');
        console.log('[Orchestrator] Starting Atomic Multi-Day Pipeline...');
        console.log('[Orchestrator] ══════════════════════════════════════════');
        
        const results = { dailyLogs: [], startDate: null, endDate: null };
        const dataSource = new DataSourceManager(options.source);

        try {
            // ── STEP 1: Find the TRUE starting point ────────────────────────
            const lastCompleteDate = await this._findLastCompleteDate();
            const startFromStr = lastCompleteDate || '2025-01-01';
            const expectedStr = marketCalendar.expectedDataDate();

            results.startDate = startFromStr;
            results.endDate = expectedStr;

            console.log(`[Orchestrator] Last COMPLETE data: ${startFromStr}`);
            console.log(`[Orchestrator] Expected data date: ${expectedStr}`);

            // ── STEP 2: Get every missing trading day ───────────────────────
            const missingDays = marketCalendar.getTradingDaysList(startFromStr, expectedStr);
            console.log(`[Orchestrator] Found ${missingDays.length} trading day(s) to process: ${missingDays.map(d => d.toISOString().split('T')[0]).join(', ')}`);

            if (missingDays.length === 0) {
                console.log('[Orchestrator] ✅ System is fully up to date. Nothing to do.');
                return { message: 'Up to date', dailyLogs: [] };
            }

            // ── PHASE 1: BULK DATA INGESTION ────────────────────────────────
            console.log('\n╔══════════════════════════════════════════╗');
            console.log('║   Phase 1: Bulk Data Ingestion           ║');
            console.log('╚══════════════════════════════════════════╝');

            const totalCalDays = lastCompleteDate
                ? marketCalendar.calendarDaysToFetch(lastCompleteDate)
                : 90;
            const priceDays = Math.min(Math.max(totalCalDays + 10, 15), 100);

            console.log(`[Orchestrator] Fetching ${priceDays} cal-days of prices, ${totalCalDays + 5} cal-days of FII/DII\n`);

            // 1.1 Events
            await this._runJob('EventScanner', () => new EventScanner().collect());

            // 1.2 Prices & OI (must run BEFORE delivery so records exist)
            await this._runJob('BulkPriceSync', () => dataSource.collectPrices({ days: priceDays }));
            await this._runJob('BulkOISync', () => dataSource.collectOiData());

            // 1.3 Delivery — for EACH missing trading day individually
            await this._runJob('BulkDeliverySync', async () => {
                let successCount = 0;
                let failCount = 0;
                for (const d of missingDays) {
                    try {
                        await deliveryService.syncDelivery(d);
                        successCount++;
                    } catch (err) {
                        console.warn(`[DeliverySync] Failed for ${d.toISOString().split('T')[0]}: ${err.message}`);
                        failCount++;
                    }
                }
                return { synced: successCount, failed: failCount };
            });

            // 1.4 FII/DII (market-wide ONLY — authentic data)
            await this._runJob('BulkMarketFiiDii', () => marketFiiDii.collect({ days: totalCalDays + 5 }));

            // 1.5 Sector & Macro
            await this._runJob('SectorSync', () => new SectorCollector().collect());
            await this._runJob('MacroSync', () => new MacroCollector().collect());

            // ── PHASE 2: ATOMIC DAY-BY-DAY ANALYSIS ─────────────────────────
            console.log('\n╔══════════════════════════════════════════╗');
            console.log('║   Phase 2: Atomic Day-by-Day Analysis    ║');
            console.log('╚══════════════════════════════════════════╝');

            for (let i = 0; i < missingDays.length; i++) {
                const targetDate = missingDays[i];
                const dateStr = targetDate.toISOString().split('T')[0];
                console.log(`\n[Orchestrator] ─── Day ${i + 1}/${missingDays.length}: ${dateStr} ───`);

                // ATOMICITY GATE: Verify critical data exists for this day
                const dataCheck = await this._verifyDayCompleteness(targetDate);

                if (!dataCheck.isComplete) {
                    console.error(`[Orchestrator] ❌ ATOMICITY FAIL for ${dateStr}: ${dataCheck.reason}`);
                    results.dailyLogs.push({
                        date: dateStr,
                        status: 'SKIPPED',
                        reason: dataCheck.reason,
                        details: dataCheck.details
                    });
                    continue;
                }

                console.log(`[Orchestrator] ✅ Data verified for ${dateStr} (${dataCheck.details.priceCount} prices, ${dataCheck.details.deliveryCount} with delivery)`);

                // Run strategy analysis for this specific date
                const dayAnalysis = await this._runJob(`Analysis-${dateStr}`, () =>
                    StockSelector.scanUniverse(targetDate)
                );

                // Sector rotation update
                await SectorRotationSystem.updateAllTimeframes();

                // AI Watchlist Update
                await this._runJob(`WatchlistAnalysis-${dateStr}`, () => WatchlistAnalyzer.analyzeAll());

                const signalsFound = Array.isArray(dayAnalysis) ? dayAnalysis.length : 0;
                results.dailyLogs.push({
                    date: dateStr,
                    status: 'SUCCESS',
                    signalsFound,
                    topSignals: Array.isArray(dayAnalysis) 
                        ? dayAnalysis.slice(0, 3).map(s => `${s.symbol}(${s.grade})`) 
                        : []
                });

                console.log(`[Orchestrator] ✅ ${dateStr} complete — ${signalsFound} signals generated`);
            }

        } finally {
            await dataSource.close();
        }

        // ── SUMMARY ─────────────────────────────────────────────────────────
        const successDays = results.dailyLogs.filter(d => d.status === 'SUCCESS').length;
        const failedDays = results.dailyLogs.filter(d => d.status === 'SKIPPED').length;

        console.log('\n[Orchestrator] ══════════════════════════════════════════');
        console.log(`[Orchestrator] Pipeline finished: ${successDays} succeeded, ${failedDays} skipped`);
        results.dailyLogs.forEach(d => {
            const icon = d.status === 'SUCCESS' ? '✅' : '❌';
            console.log(`  ${icon} ${d.date}: ${d.status}${d.signalsFound ? ` (${d.signalsFound} signals)` : ''}${d.reason ? ` — ${d.reason}` : ''}`);
        });
        console.log('[Orchestrator] ══════════════════════════════════════════\n');

        return results;
    }

    /**
     * Verify that a trading day has COMPLETE critical data in the DB.
     * Checks: price records exist AND have delivery data.
     */
    async _verifyDayCompleteness(date) {
        const targetDate = new Date(date);
        targetDate.setUTCHours(12, 0, 0, 0);

        // Count total price records for this date
        const priceCount = await DailyPrice.countDocuments({ date: targetDate });

        // Count records that have valid delivery data
        const deliveryCount = await DailyPrice.countDocuments({
            date: targetDate,
            deliveryPct: { $exists: true, $gt: 0 }
        });

        const details = { priceCount, deliveryCount };

        if (priceCount < 10) {
            return { isComplete: false, reason: `Too few price records (${priceCount})`, details };
        }

        if (deliveryCount < 20) {
            return { isComplete: false, reason: `Missing Delivery Data (only ${deliveryCount}/${priceCount} have delivery%)`, details };
        }

        return { isComplete: true, details };
    }

    /**
     * Run a job with error isolation and timing.
     */
    async _runJob(name, jobFn) {
        console.log(`[Job] ${name} starting...`);
        try {
            const start = Date.now();
            const result = await jobFn();
            const elapsed = ((Date.now() - start) / 1000).toFixed(2);
            console.log(`[Job] ${name} ✅ (${elapsed}s)`);
            return result;
        } catch (err) {
            console.error(`[Job] ${name} ❌ FAILED:`, err.message);
            return { error: err.message };
        }
    }
}

module.exports = new PipelineCoordinator();
