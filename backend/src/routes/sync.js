const express = require('express');
const router = express.Router();
const DailyPrice = require('../models/DailyPrice');
const SmartMoneyScore = require('../models/SmartMoneyScore');
const mongoose = require('mongoose');
const { runPipeline } = require('../scheduler/cron');
const marketCalendar = require('../services/MarketCalendar');

// ---------------------------------------------------------------------------
// Sync State — persisted in MongoDB to survive nodemon/server restarts.
// ---------------------------------------------------------------------------
const SyncStateSchema = new mongoose.Schema({
    _id: { type: String, default: 'singleton' },
    isSyncing: { type: Boolean, default: false },
    syncStartedAt: { type: Date, default: null },
    lastSyncResult: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: false });

const SyncState = mongoose.models.SyncState || mongoose.model('SyncState', SyncStateSchema);

// Helper — get or create the singleton sync state document
async function getState() {
    let state = await SyncState.findById('singleton');
    if (!state) {
        state = await SyncState.create({ _id: 'singleton' });
    }

    // Failsafe A: isSyncing=true but syncStartedAt is null → stale flag from a crashed process
    if (state.isSyncing && !state.syncStartedAt) {
        console.warn('[Sync] isSyncing=true but syncStartedAt is null — stale flag. Auto-resetting.');
        state.isSyncing = false;
        await state.save();
        return state;
    }

    // Failsafe B: stuck for > 20 minutes → auto-reset
    if (state.isSyncing && state.syncStartedAt) {
        const elapsed = Date.now() - new Date(state.syncStartedAt).getTime();
        if (elapsed > 20 * 60 * 1000) {
            console.warn(`[Sync] Stuck flag detected (${(elapsed / 60000).toFixed(1)}min). Auto-resetting isSyncing.`);
            state.isSyncing = false;
            state.syncStartedAt = null;
            await state.save();
        }
    }

    return state;
}

/**
 * Find the last FULLY COMPLETE date in the DB.
 * Complete = has price data + delivery data + SmartMoneyScore analysis.
 * This is the TRUE "Source of Truth" — not just the latest price record.
 */
async function findLastCompleteDate() {
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

        if (!marketCalendar.isTradingDay(dateStr)) continue;

        const deliveryCount = await DailyPrice.countDocuments({
            date: dateObj,
            deliveryPct: { $exists: true, $gt: 0 }
        });

        if (deliveryCount < 20) continue;

        const analysisCount = await SmartMoneyScore.countDocuments({ date: dateObj });
        if (analysisCount === 0) continue;

        return dateStr;
    }

    return null;
}

// GET /api/v1/sync/status
router.get('/status', async (req, res) => {
    try {
        const state = await getState();

        const todayStr    = marketCalendar._toIST(new Date());
        const expectedStr = marketCalendar.expectedDataDate();

        // Find last COMPLETE date (not just latest price)
        const lastCompleteStr = await findLastCompleteDate();
        
        // Also get latest raw price date for comparison
        const latestPrice = await DailyPrice.findOne().sort({ date: -1 }).select('date').lean();
        const latestPriceDateStr = latestPrice ? marketCalendar._toIST(new Date(latestPrice.date)) : null;

        if (!latestPrice) {
            return res.json({
                needsSync: true,
                message: 'No data found',
                isSyncing: state.isSyncing,
                expectedDate: expectedStr,
                currentDate: todayStr,
                isMarketHoliday: !marketCalendar.isTradingDay(todayStr),
            });
        }

        // needsSync: based on COMPLETE date, not raw price date
        const effectiveDate = lastCompleteStr || '2025-01-01';
        const needsSync = effectiveDate < expectedStr;

        // Count missing trading days from last COMPLETE date
        const tradingDaysMissing = needsSync
            ? marketCalendar.tradingDaysBetween(effectiveDate, expectedStr)
            : 0;

        const calDaysToFetch = needsSync
            ? marketCalendar.calendarDaysToFetch(effectiveDate)
            : 0;

        // Build list of missing days for frontend display
        const missingDaysList = needsSync
            ? marketCalendar.getTradingDaysList(effectiveDate, expectedStr).map(d => d.toISOString().split('T')[0])
            : [];

        res.json({
            needsSync,
            lastCompleteDate:   lastCompleteStr,
            latestDataDate:     latestPriceDateStr,
            expectedDate:       expectedStr,
            currentDate:        todayStr,
            isSyncing:          state.isSyncing,
            isMarketHoliday:    !marketCalendar.isTradingDay(todayStr),
            isMarketOpen:       marketCalendar.isMarketOpen(),
            tradingDaysMissing,
            calDaysToFetch,
            missingDays:        missingDaysList,
            lastSync: state.lastSyncResult ? {
                success:   state.lastSyncResult.success,
                timestamp: state.lastSyncResult.timestamp,
                summary:   state.lastSyncResult.summary,
                error:     state.lastSyncResult.error,
            } : null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/sync/run
router.post('/run', async (req, res) => {
    const state = await getState();

    if (state.isSyncing) {
        return res.status(409).json({ message: 'Sync already in progress' });
    }

    // ── Find last COMPLETE date ────────────────────────────────────────────
    const lastCompleteStr = await findLastCompleteDate();
    const expectedStr = marketCalendar.expectedDataDate();

    if (lastCompleteStr && lastCompleteStr >= expectedStr) {
        console.log(`[Sync] STRICT ABORT — Data is fully complete up to ${expectedStr}. Sync rejected.`);
        return res.json({
            message: 'Data is fully up to date. All days have complete data + analysis.',
            alreadySynced: true,
            lastCompleteDate: lastCompleteStr,
            expectedDate: expectedStr,
            lastSync: state.lastSyncResult,
        });
    }

    // ── Calculate missing days ──────────────────────────────────────────────
    const effectiveStart = lastCompleteStr || '2025-01-01';
    const missingDays = marketCalendar.getTradingDaysList(effectiveStart, expectedStr);

    console.log(`[Sync] Last COMPLETE: ${effectiveStart} | Expected: ${expectedStr} | Missing: ${missingDays.length} trading days`);
    console.log(`[Sync] Days to process: ${missingDays.map(d => d.toISOString().split('T')[0]).join(', ')}`);

    // Mark as syncing in DB (survives restarts)
    state.isSyncing    = true;
    state.syncStartedAt = new Date();
    await state.save();

    // Fire and forget — pipeline handles everything internally
    runPipeline().then(async results => {
        console.log('[Sync] Background sync completed successfully');
        await SyncState.findByIdAndUpdate('singleton', {
            isSyncing:      false,
            syncStartedAt:  null,
            lastSyncResult: { success: true, timestamp: new Date(), summary: results },
        });
    }).catch(async err => {
        console.error('[Sync] Background sync failed:', err.message);
        await SyncState.findByIdAndUpdate('singleton', {
            isSyncing:      false,
            syncStartedAt:  null,
            lastSyncResult: { success: false, timestamp: new Date(), error: err.message },
        });
    });

    res.json({
        message: `Atomic Multi-Day Sync started. Processing ${missingDays.length} missing trading day(s).`,
        lastCompleteDate: effectiveStart,
        expectedDate: expectedStr,
        tradingDaysMissing: missingDays.length,
        missingDays: missingDays.map(d => d.toISOString().split('T')[0])
    });
});

// POST /api/v1/sync/reset  — Emergency manual reset
router.post('/reset', async (req, res) => {
    await SyncState.findByIdAndUpdate('singleton', {
        isSyncing:      false,
        syncStartedAt:  null,
    }, { upsert: true });
    console.log('[Sync] Manual reset triggered via /reset endpoint.');
    res.json({ message: 'Sync state reset successfully.' });
});

module.exports = router;
