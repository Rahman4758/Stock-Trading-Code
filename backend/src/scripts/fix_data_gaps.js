/**
 * Targeted Data Fix Script — InstitutionalEdge
 * 
 * Fixes in order:
 *  1. Delivery data for dates that have prices but deliveryPct = 0
 *     (May 4, May 5, May 28 — verified against NSE calendar that these are trading days)
 *  2. May 28 full price backfill (if price data also missing)
 *  3. Bulk Deals backfill (stuck at April 27)
 *  4. Re-run scanUniverse for dates with PENDING grades
 *  5. Re-run FII/DII for any gaps
 *
 * Jun 6 (Bakrid holiday) and Jun 7 (Saturday) are SKIPPED as non-trading days.
 *
 * Run from: c:\Stock-Trading-code\backend
 * Usage: node src/scripts/fix_data_gaps.js
 */

require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const marketCalendar = require('../services/MarketCalendar');
const deliveryService = require('../services/deliveryIntegrityService');
const marketFiiDii = require('../collectors/marketFiiDii');
const DataSourceManager = require('../collectors/dataSourceManager');
const StockSelector = require('../core/stockSelector');
const BulkDealsCollector = require('../collectors/bulkDeals');
const DailyPrice = require('../models/DailyPrice');
const SmartMoneyScore = require('../models/SmartMoneyScore');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkDateInDb(dateStr) {
    const dateObj = new Date(dateStr + 'T12:00:00.000Z');
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay   = new Date(dateStr + 'T23:59:59.999Z');
    const priceCount    = await DailyPrice.countDocuments({ date: { $gte: startOfDay, $lte: endOfDay } });
    const deliveryCount = await DailyPrice.countDocuments({ date: { $gte: startOfDay, $lte: endOfDay }, deliveryPct: { $gt: 0 } });
    const scoreCount    = await SmartMoneyScore.countDocuments({ date: dateObj });
    return { dateStr, priceCount, deliveryCount, scoreCount };
}

function log(msg) { console.log(`[Fix] ${msg}`); }
function warn(msg) { console.warn(`[Fix] ⚠️  ${msg}`); }
function ok(msg)   { console.log(`[Fix] ✅ ${msg}`); }
function err(msg)  { console.error(`[Fix] ❌ ${msg}`); }

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    await mongoose.connect(MONGO_URI);
    log('Connected to MongoDB');

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║        InstitutionalEdge — Targeted Data Fix             ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ── Step 0: Verify what needs fixing ──────────────────────────────────
    log('Step 0: Auditing dates that need fixing...');

    // Dates with missing delivery (confirmed trading days, excluding Jun 6 Bakrid + Jun 7 weekend)
    const deliveryOnlyFix = ['2026-05-05', '2026-05-04'];  // prices present, delivery missing
    const fullBackfill    = ['2026-05-28'];                 // price + delivery + scores all missing

    // Verify which are actual trading days per NSE calendar
    const tradingDaysToFix = [...deliveryOnlyFix, ...fullBackfill].filter(d => {
        const isTrading = marketCalendar.isTradingDay(d);
        if (!isTrading) warn(`${d} is NOT a trading day per NSE calendar — skipping`);
        return isTrading;
    });

    log(`Trading days confirmed for fix: ${tradingDaysToFix.join(', ')}`);

    // Current state audit
    console.log('\n   Current DB state for target dates:');
    for (const d of tradingDaysToFix) {
        const s = await checkDateInDb(d);
        console.log(`   ${d}: Price=${s.priceCount} | Delivery=${s.deliveryCount} | Scores=${s.scoreCount}`);
    }

    // ── Step 1: Fix delivery for May 4 & May 5 (prices exist, delivery=0) ─
    console.log('\n══ Step 1: Fixing delivery data for May 4 & May 5 ══════════');
    for (const dateStr of deliveryOnlyFix) {
        if (!marketCalendar.isTradingDay(dateStr)) {
            warn(`${dateStr} is not a trading day — skipping delivery fix`);
            continue;
        }
        try {
            const date = new Date(dateStr + 'T12:00:00.000Z');
            log(`Fetching NSE delivery CSV for ${dateStr}...`);
            const count = await deliveryService.syncDelivery(date);
            ok(`${dateStr}: Updated ${count} delivery records`);
        } catch (e) {
            err(`${dateStr} delivery fix failed: ${e.message}`);
        }
        await sleep(3000); // Be polite to NSE servers
    }

    // ── Step 2: Backfill May 28 — full price + delivery + scores ──────────
    console.log('\n══ Step 2: Backfilling May 28 (complete missing date) ══════');
    const may28State = await checkDateInDb('2026-05-28');
    if (may28State.priceCount === 0) {
        log('May 28 has no price data. Fetching via DataSourceManager (Upstox)...');
        const dsm = new DataSourceManager('upstox');
        try {
            // Fetch ~30 days of prices which will include May 28
            await dsm.collectPrices({ days: 30 });
            ok('Price fetch complete. Checking May 28 now...');
            await sleep(2000);

            const afterFetch = await checkDateInDb('2026-05-28');
            if (afterFetch.priceCount > 0) {
                ok(`May 28: Now has ${afterFetch.priceCount} price records!`);
                // Now fix delivery for May 28
                log('Fetching delivery for May 28...');
                const count = await deliveryService.syncDelivery(new Date('2026-05-28T12:00:00.000Z'));
                ok(`May 28 delivery: ${count} records updated`);
            } else {
                warn('May 28 still has 0 price records after fetch. NSE may not have had trading that day.');
            }
        } catch (e) {
            err(`May 28 price backfill failed: ${e.message}`);
        } finally {
            await dsm.close();
        }
    } else {
        ok(`May 28 already has ${may28State.priceCount} price records. Only fixing delivery...`);
        if (may28State.deliveryCount === 0) {
            try {
                const count = await deliveryService.syncDelivery(new Date('2026-05-28T12:00:00.000Z'));
                ok(`May 28 delivery: ${count} records updated`);
            } catch (e) {
                err(`May 28 delivery fix: ${e.message}`);
            }
        }
    }

    // ── Step 3: Bulk Deals backfill (stuck at April 27) ───────────────────
    console.log('\n══ Step 3: Backfilling Bulk Deals (April 28 → Jun 05) ══════');
    log('Initializing BulkDealsCollector...');
    const bulkCollector = new BulkDealsCollector();
    try {
        // Collect last 45 days — this covers April 28 to June 05 (40+ trading days)
        const result = await bulkCollector.collect({ days: 45 });
        ok(`Bulk Deals: ${result.count} new records added across ${result.daysCollected} days`);
    } catch (e) {
        err(`Bulk Deals backfill failed: ${e.message}`);
    }

    // ── Step 4: FII/DII gap check and re-fetch ────────────────────────────
    console.log('\n══ Step 4: Re-fetching FII/DII for any gaps ════════════════');
    try {
        log('Running marketFiiDii.collect({ days: 45 })...');
        const fiiResult = await marketFiiDii.collect({ days: 45 });
        ok(`FII/DII: ${JSON.stringify(fiiResult)}`);
    } catch (e) {
        err(`FII/DII re-fetch failed: ${e.message}`);
    }

    // ── Step 5: Re-run scanUniverse for dates with PENDING scores ─────────
    console.log('\n══ Step 5: Re-scanning dates with PENDING/missing signals ══');

    // Find all dates in the last 30 days where scores are PENDING or missing
    const recentScoreDates = await SmartMoneyScore.aggregate([
        { $sort: { date: -1 } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            pendingCount: { $sum: { $cond: [{ $eq: ['$grade', 'PENDING'] }, 1, 0] } },
            totalCount: { $sum: 1 }
        }},
        { $sort: { _id: -1 } },
        { $limit: 15 }
    ]);

    const datesToRescan = [];
    for (const d of recentScoreDates) {
        const pctPending = d.pendingCount / d.totalCount;
        if (pctPending > 0.5) {
            // More than 50% are PENDING — this means scanUniverse didn't really run
            log(`${d._id}: ${d.pendingCount}/${d.totalCount} records are PENDING → will re-scan`);
            datesToRescan.push(d._id);
        }
    }

    // Also include May 28 if it was backfilled
    const may28After = await checkDateInDb('2026-05-28');
    if (may28After.priceCount >= 20 && may28After.deliveryCount >= 20 && may28After.scoreCount === 0) {
        datesToRescan.push('2026-05-28');
    }

    if (datesToRescan.length === 0) {
        ok('No dates need re-scanning!');
    } else {
        log(`Will re-scan ${datesToRescan.length} date(s): ${datesToRescan.join(', ')}`);

        // Sort ascending so we process chronologically
        datesToRescan.sort();

        for (const dateStr of datesToRescan) {
            if (!marketCalendar.isTradingDay(dateStr)) {
                warn(`${dateStr} is not a trading day — skipping scan`);
                continue;
            }
            try {
                const dbState = await checkDateInDb(dateStr);
                if (dbState.priceCount < 10 || dbState.deliveryCount < 20) {
                    warn(`${dateStr}: Insufficient data (price=${dbState.priceCount}, delivery=${dbState.deliveryCount}) — skipping scan`);
                    continue;
                }
                log(`Re-scanning ${dateStr}...`);
                const targetDate = new Date(dateStr + 'T12:00:00.000Z');
                const results = await StockSelector.scanUniverse(targetDate);
                ok(`${dateStr}: ${results.length} signals generated`);
                await sleep(1000);
            } catch (e) {
                err(`Scan failed for ${dateStr}: ${e.message}`);
            }
        }
    }

    // ── Step 6: Final verification ─────────────────────────────────────────
    console.log('\n══ Step 6: Final Verification ══════════════════════════════');
    const verifyDates = ['2026-05-04', '2026-05-05', '2026-05-28', '2026-06-05'];
    console.log('   Date         | Price | Delivery | Scores | Status');
    console.log('   -------------|-------|----------|--------|-------');
    for (const d of verifyDates) {
        const s = await checkDateInDb(d);
        const isTradingDay = marketCalendar.isTradingDay(d);
        if (!isTradingDay) {
            console.log(`   ${d}  |  --   |    --    |   --   | ⛔ Non-trading day`);
            continue;
        }
        const priceOk    = s.priceCount >= 20;
        const deliveryOk = s.deliveryCount >= 20;
        const status = priceOk && deliveryOk ? '✅ Complete' : (!priceOk ? '❌ No price' : '⚠️  No delivery');
        console.log(`   ${d}  | ${String(s.priceCount).padEnd(5)} |   ${String(s.deliveryCount).padEnd(5)}  |  ${String(s.scoreCount).padEnd(4)}  | ${status}`);
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              Fix Script Complete ✅                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    await mongoose.disconnect();
}

main().catch(e => {
    console.error('\n❌ Fix script CRASHED:', e.message);
    console.error(e.stack);
    process.exit(1);
});
