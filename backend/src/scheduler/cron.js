const cron = require('node-cron');
const DataSourceManager = require('../collectors/dataSourceManager');
const SectorCollector = require('../collectors/sectorCollector');
const EventScanner = require('../collectors/eventScanner');
const SnapshotBuilder = require('../services/SnapshotBuilder');
const Stock = require('../models/Stock');
const PaperPriceUpdater = require('../services/PaperPriceUpdater');
const PaperTradingService = require('../services/PaperTradingService');

/**
 * Daily pipeline:
 * Runs Monday–Friday at 15:45 IST (10:15 UTC)
 * 
 * Data Source is controlled by DATA_SOURCE env var:
 * - 'nse' = NSE Puppeteer (default)
 * - 'upstox' = Upstox API (when configured)
 */
const scheduleDailyPipeline = () => {
    // 1. Pre-Market Validator (9:00 AM IST)
    cron.schedule('30 3 * * 1-5', async () => {
        console.log('\n[Scheduler] Pre-Market Validator triggered at', new Date().toISOString());
        await runPreMarketValidator();
    }, { timezone: 'UTC' });

    // 2. Main EOD Pipeline & Journal (19:00 IST / 13:30 UTC)
    // Runs after BhavCopy and OI data is officially published
    cron.schedule('30 13 * * 1-5', async () => {
        console.log('\n[Scheduler] Daily pipeline & Journaling triggered at', new Date().toISOString());
        await runPipeline();
        await runEodJournal();
    }, { timezone: 'UTC' });

    // 2.5 Stage 1: "BhavCopy Sync" (18:45 IST / 13:15 UTC)
    // Fetches the authentic delivery data foundation
    cron.schedule('15 13 * * 1-5', async () => {
        console.log('\n[Scheduler] Stage 1: BhavCopy Sync triggered at', new Date().toISOString());
        try {
            const deliveryService = require('../services/deliveryIntegrityService');
            await deliveryService.syncDelivery();
        } catch (e) {
            console.error('[Scheduler] BhavCopy Stage Failed:', e.message);
        }
    }, { timezone: 'UTC' });

    // 2.6 Stage 2: "Upstox & Conviction" (18:50 IST / 13:20 UTC)
    // Enrichment and strategy execution after BhavCopy is settled
    cron.schedule('20 13 * * 1-5', async () => {
        console.log('\n[Scheduler] Stage 2: Upstox & Analysis triggered at', new Date().toISOString());
        await runPipeline('upstox');
        await runEodJournal();
    }, { timezone: 'UTC' });

    // 3. Paper Trading Price Ticker (Every minute 9:15 AM - 3:30 PM IST)
    // DISABLED: User requested to stop live fetching since this is an EOD system.
    // cron.schedule('*/1 3-10 * * 1-5', async () => {
    //     const now = new Date();
    //     const hour = now.getUTCHours();
    //     const min = now.getUTCMinutes();
    //     
    //     if (hour === 3 && min < 45) return;
    //     if (hour === 10 && min > 0) return;
    //
    //     await PaperPriceUpdater.tick();
    // }, { timezone: 'UTC' });

    // 4. Paper Trading Intraday Mandatory Exit (3:15 PM IST / 9:45 AM UTC)
    cron.schedule('45 9 * * 1-5', async () => {
        await PaperPriceUpdater.runIntradayForceClose();
    }, { timezone: 'UTC' });

    // 5. Federal Bank Swing Scan — Auto runs daily at 8:00 PM IST (14:30 UTC)
    // After all EOD data is settled (BhavCopy + OI + Conviction)
    cron.schedule('30 14 * * 1-5', async () => {
        console.log('\n[Scheduler] Federal Bank Swing Scan triggered at', new Date().toISOString());
        try {
            const SwingScanner = require('../services/SwingScanner');
            await SwingScanner.runFullScan();
        } catch (e) {
            console.error('[Scheduler] SwingScan failed:', e.message);
        }
    }, { timezone: 'UTC' });

    // 6. Portfolio Tracking Daily Update — 8:30 PM IST (15:00 UTC)
    cron.schedule('0 15 * * 1-5', async () => {
        console.log('\n[Scheduler] Portfolio Tracking Update triggered at', new Date().toISOString());
        try {
            const SwingScanner = require('../services/SwingScanner');
            await SwingScanner.trackPortfolioStocks();
            await SwingScanner.trackStrategySignals();
        } catch (e) {
            console.error('[Scheduler] Portfolio tracking failed:', e.message);
        }
    }, { timezone: 'UTC' });

    console.log('[Scheduler] Multi-Agent schedules active:');
    console.log('    - 09:00 IST: Pre-Market Validator');
    console.log('    - 15:45 IST: EOD Pipeline & Trade Journal');
    console.log('    - 20:00 IST: Federal Bank Swing Scan (auto)');
    console.log('    - 20:30 IST: Portfolio Tracking Daily Update');
};

const runPreMarketValidator = async () => {
    console.log('[Validator] Running 9:00 AM Pre-Market rules...');
    try {
        const PreMarketValidator = require('../services/PreMarketValidator');
        const TradeJournal = require('../models/TradeJournal');
        const queuedTrades = await TradeJournal.find({ status: 'OPEN', entry_date: { $gte: new Date().setHours(0,0,0,0) } });
        
        if (queuedTrades.length > 0) {
            await PreMarketValidator.validate(queuedTrades, { sgx_change: 0.2, vix: 14.8 });
        }
    } catch (e) {
        console.error('[Validator] Failed:', e.message);
    }
};

const runEodJournal = async () => {
    console.log('[Journal] Generating EOD debrief...');
    try {
        const JournalAgent = require('../services/JournalAgent');
        const TradeJournal = require('../models/TradeJournal');
        const today = new Date().setHours(0,0,0,0);
        const trades = await TradeJournal.find({ updatedAt: { $gte: today } });
        await JournalAgent.generateDailyJournal({ date: new Date().toISOString(), trades, cancelled: [] });
    } catch (e) {
        console.error('[Journal] Failed:', e.message);
    }
};

const runPipeline = async (source = null, days = null) => {
    const PipelineCoordinator = require('../services/PipelineCoordinator');
    return await PipelineCoordinator.runFullPipeline({ source: source || 'upstox', days });
};


/**
 * Run pipeline with specific data source
 * Usage: runPipelineWithSource('upstox') or runPipelineWithSource('nse')
 */
const runPipelineWithSource = async (source) => {
    return await runPipeline(source);
};

module.exports = { scheduleDailyPipeline, runPipeline, runPipelineWithSource };
