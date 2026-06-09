/**
 * Fix Remaining Gaps — Step 2, 3, 4, 5
 * (Step 1 already done: May 4 & 5 delivery ✅)
 *
 * Run from: c:\Stock-Trading-code\backend
 * Usage: node src/scripts/fix_remaining.js
 */
const path = require('path');
// Load .env from src/ directory explicitly
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const marketCalendar = require('../services/MarketCalendar');
const deliveryService = require('../services/deliveryIntegrityService');
const marketFiiDii   = require('../collectors/marketFiiDii');
const StockSelector  = require('../core/stockSelector');
const BulkDealsCollector = require('../collectors/bulkDeals');
const DailyPrice     = require('../models/DailyPrice');
const SmartMoneyScore = require('../models/SmartMoneyScore');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge';

function log(msg)  { console.log(`[Fix] ${msg}`); }
function ok(msg)   { console.log(`[Fix] ✅ ${msg}`); }
function warn(msg) { console.warn(`[Fix] ⚠️  ${msg}`); }
function fail(msg) { console.error(`[Fix] ❌ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkDate(dateStr) {
    const start = new Date(dateStr + 'T00:00:00.000Z');
    const end   = new Date(dateStr + 'T23:59:59.999Z');
    const priceCount    = await DailyPrice.countDocuments({ date: { $gte: start, $lte: end } });
    const deliveryCount = await DailyPrice.countDocuments({ date: { $gte: start, $lte: end }, deliveryPct: { $gt: 0 } });
    const scoreCount    = await SmartMoneyScore.countDocuments({ date: new Date(dateStr + 'T12:00:00.000Z') });
    return { priceCount, deliveryCount, scoreCount };
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║    InstitutionalEdge — Fix Remaining Gaps (Steps 2–5)   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    log(`NODE_ENV: ${process.env.NODE_ENV}`);
    log(`MONGO_URI: ${MONGO_URI}`);
    log(`UPSTOX_API_KEY: ${process.env.UPSTOX_API_KEY ? '✅ present' : '❌ missing'}`);
    log(`UPSTOX_ACCESS_TOKEN: ${process.env.UPSTOX_ACCESS_TOKEN ? '✅ present' : '❌ missing'}\n`);

    await mongoose.connect(MONGO_URI);
    log('Connected to MongoDB\n');

    // ── Step 2: May 28 — try NSE bhavcopy CSV (same method as delivery but for full OHLCV) ──
    console.log('══ Step 2: May 28 — Attempt price fetch via Upstox API ════════');
    const may28Before = await checkDate('2026-05-28');
    log(`May 28 state: Price=${may28Before.priceCount} | Delivery=${may28Before.deliveryCount} | Scores=${may28Before.scoreCount}`);

    if (may28Before.priceCount === 0) {
        // Try Upstox directly if token is present
        const token = process.env.UPSTOX_ACCESS_TOKEN;
        const apiKey = process.env.UPSTOX_API_KEY;

        if (token && apiKey) {
            log('Attempting Upstox historical OHLCV for May 28...');
            const UpstoxCollector = require('../collectors/upstoxCollector');
            const upstox = new UpstoxCollector();
            try {
                // collectPrices fetches last N days of OHLCV from Upstox
                // May 28 is about 10 days ago — fetch 15 days to cover it
                const result = await upstox.collectPrices({ days: 15 });
                await sleep(2000);
                const may28After = await checkDate('2026-05-28');
                log(`May 28 after Upstox fetch: Price=${may28After.priceCount}`);
                if (may28After.priceCount > 0) {
                    ok(`May 28 prices fetched: ${may28After.priceCount} records`);
                    // Now fetch delivery
                    try {
                        const count = await deliveryService.syncDelivery(new Date('2026-05-28T12:00:00.000Z'));
                        ok(`May 28 delivery: ${count} records`);
                    } catch (e) {
                        fail(`May 28 delivery: ${e.message}`);
                    }
                } else {
                    warn('May 28 still has 0 prices after Upstox. May 28 may be NSE holiday (Buddha Purnima or another).');
                    // Double-check with MarketCalendar
                    const isTradingDay = marketCalendar.isTradingDay('2026-05-28');
                    if (!isTradingDay) {
                        warn('MarketCalendar says May 28 is NOT a trading day. Confirmed — skipping.');
                    } else {
                        warn('MarketCalendar says May 28 IS a trading day, but Upstox has no data. NSE was likely closed (unofficial holiday or data not available).');
                    }
                }
            } catch (e) {
                fail(`Upstox price fetch failed: ${e.message}`);
            }
        } else {
            warn('Upstox credentials not in env. Check .env file. Skipping May 28 price backfill.');
            warn('May 28 data will remain missing until next regular sync runs on Monday.');
        }
    } else {
        ok(`May 28 already has ${may28Before.priceCount} price records — checking delivery only`);
        if (may28Before.deliveryCount === 0) {
            try {
                const count = await deliveryService.syncDelivery(new Date('2026-05-28T12:00:00.000Z'));
                ok(`May 28 delivery: ${count} records updated`);
            } catch (e) {
                fail(`May 28 delivery: ${e.message}`);
            }
        }
    }

    await sleep(2000);

    // ── Step 3: Bulk Deals — backfill April 28 → June 5 ──────────────────
    console.log('\n══ Step 3: Bulk Deals Backfill (Apr 28 → Jun 05) ════════════');
    log('NSE bulk deals API uses cookies — initializing...');
    const bulkCollector = new BulkDealsCollector();
    try {
        const result = await bulkCollector.collect({ days: 45 });
        ok(`Bulk Deals: ${result.count} new records added`);
    } catch (e) {
        fail(`Bulk deals failed: ${e.message}`);
    }

    await sleep(2000);

    // ── Step 4: FII/DII re-fetch for last 45 days ─────────────────────────
    console.log('\n══ Step 4: FII/DII Re-fetch (last 45 days) ══════════════════');
    try {
        const fiiResult = await marketFiiDii.collect({ days: 45 });
        ok(`FII/DII: ${JSON.stringify(fiiResult)}`);
    } catch (e) {
        fail(`FII/DII failed: ${e.message}`);
    }

    await sleep(2000);

    // ── Step 5: Re-run scanUniverse for dates with PENDING grades ─────────
    console.log('\n══ Step 5: Re-scan dates with PENDING signals ════════════════');

    // Find dates where >50% are PENDING
    const recentScoreDates = await SmartMoneyScore.aggregate([
        { $sort: { date: -1 } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                pendingCount: { $sum: { $cond: [{ $eq: ['$grade', 'PENDING'] }, 1, 0] } },
                totalCount: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } },
        { $limit: 20 }
    ]);

    const datesToRescan = [];
    for (const d of recentScoreDates) {
        const pctPending = d.totalCount > 0 ? (d.pendingCount / d.totalCount) : 0;
        if (pctPending > 0.5 && marketCalendar.isTradingDay(d._id)) {
            log(`${d._id}: ${d.pendingCount}/${d.totalCount} PENDING (${(pctPending*100).toFixed(0)}%) → queued for re-scan`);
            datesToRescan.push(d._id);
        }
    }

    // Check May 28 after potential backfill
    const may28Final = await checkDate('2026-05-28');
    if (may28Final.priceCount >= 20 && may28Final.deliveryCount >= 20 && may28Final.scoreCount === 0) {
        datesToRescan.push('2026-05-28');
    }

    datesToRescan.sort(); // chronological order
    log(`Dates to re-scan: ${datesToRescan.length > 0 ? datesToRescan.join(', ') : 'None'}\n`);

    for (const dateStr of datesToRescan) {
        const state = await checkDate(dateStr);
        if (state.priceCount < 10) {
            warn(`${dateStr}: Only ${state.priceCount} price records — insufficient for scan, skipping`);
            continue;
        }
        if (state.deliveryCount < 20) {
            warn(`${dateStr}: Only ${state.deliveryCount} delivery records — skipping scan`);
            continue;
        }
        try {
            log(`Scanning ${dateStr}...`);
            const targetDate = new Date(dateStr + 'T12:00:00.000Z');
            const results = await StockSelector.scanUniverse(targetDate);
            ok(`${dateStr}: ${results.length} signals generated`);
        } catch (e) {
            fail(`Scan ${dateStr}: ${e.message}`);
        }
        await sleep(1000);
    }

    // ── Step 6: Final Verification Report ─────────────────────────────────
    console.log('\n══ Final Verification ════════════════════════════════════════');

    // All trading dates from May 4 to June 5
    const verifyDates = marketCalendar.getTradingDaysList('2026-05-03', '2026-06-05')
        .map(d => d.toISOString().split('T')[0]);

    console.log('\n   Date         | Price | Delivery | Scores | Status');
    console.log('   -------------|-------|----------|--------|-------');

    let issues = 0;
    for (const d of verifyDates) {
        const s = await checkDate(d);
        const priceOk    = s.priceCount >= 20;
        const deliveryOk = s.deliveryCount >= 20;
        let status;
        if (priceOk && deliveryOk) status = '✅ Complete';
        else if (!priceOk)         status = `❌ No price data`;
        else                       status = `⚠️  No delivery`;
        if (!priceOk || !deliveryOk) issues++;
        console.log(`   ${d}  | ${String(s.priceCount).padEnd(5)} |   ${String(s.deliveryCount).padEnd(5)}  |  ${String(s.scoreCount).padEnd(4)}  | ${status}`);
    }

    // FII/DII summary
    const db = mongoose.connection.db;
    const fiiCount = await db.collection('fiidiidatas').countDocuments();
    const latestFii = await db.collection('fiidiidatas').find({ symbol: 'TOTAL_MARKET' }).sort({ date: -1 }).limit(3).toArray();
    console.log(`\n   FII/DII records: ${fiiCount}`);
    for (const f of latestFii) {
        const d = f.date?.toISOString?.()?.split('T')[0];
        console.log(`   ${d} | FII Net: ${((f.fiiNet ?? 0)/1e7).toFixed(2)}Cr | DII Net: ${((f.diiNet ?? 0)/1e7).toFixed(2)}Cr`);
    }

    // Bulk deals latest
    const latestBulkDate = await db.collection('bulkdeals').aggregate([
        { $sort: { date: -1 } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 3 }
    ]).toArray();
    console.log(`\n   Bulk Deals latest dates:`);
    for (const b of latestBulkDate) console.log(`   ${b._id} | ${b.count} deals`);

    console.log(`\n   Issues remaining: ${issues}`);
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  Fix Complete ${issues === 0 ? '✅ All clean!' : `⚠️  ${issues} date(s) need attention`}                         ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    await mongoose.disconnect();
}

main().catch(e => {
    console.error('\n❌ Fix script CRASHED:', e.message);
    console.error(e.stack);
    process.exit(1);
});
