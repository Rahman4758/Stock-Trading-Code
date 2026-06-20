const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { connectMongo } = require('../config/db');

// Collectors
const DataSourceManager = require('../collectors/dataSourceManager');
const deliveryService = require('../services/deliveryIntegrityService');

// Models
const Stock = require('../models/Stock');
const DailyPrice = require('../models/DailyPrice');

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function run() {
    console.log('[Backfill] Connecting to Mongo...');
    await connectMongo();

    const ds = new DataSourceManager('upstox');
    await ds.init();

    // 1. Fetch Prices for ALL stocks (it uses upsert, so it's safe)
    console.log('\n[Backfill] Step 1: Fetching OHLCV from Upstox for all stocks (60 days)...');
    try {
        const priceResult = await ds.collectPrices({ days: 60 });
        console.log(`[Backfill] Price sync complete. Saved: ${priceResult.saved}, Failed: ${priceResult.failed}`);
    } catch (e) {
        console.error('[Backfill] Price sync failed:', e.message);
    }

    // 2. Fetch Delivery for the last 5 trading days
    console.log('\n[Backfill] Step 2: Fetching authentic Delivery Data from NSE BhavCopy...');
    const marketCalendar = require('../services/MarketCalendar');
    const today = new Date();
    const daysToSync = [];
    
    // Get last 5 trading days
    let d = new Date(today);
    while (daysToSync.length < 5) {
        if (marketCalendar.isTradingDay(d)) {
            daysToSync.push(new Date(d));
        }
        d.setDate(d.getDate() - 1);
    }

    for (const date of daysToSync) {
        console.log(`[Backfill] Syncing Delivery for ${date.toISOString().split('T')[0]}...`);
        try {
            await deliveryService.syncDelivery(date);
            await new Promise(r => setTimeout(r, 2000)); // sleep to avoid NSE rate limit
        } catch (e) {
            console.error(`[Backfill] Delivery sync failed for ${date.toISOString().split('T')[0]}:`, e.message);
        }
    }

    // 3. Sync OI Data (Will skip non-FNO stocks automatically based on Upstox logic)
    console.log('\n[Backfill] Step 3: Fetching OI data...');
    try {
        const oiResult = await ds.collectOiData();
        console.log(`[Backfill] OI sync complete. Saved: ${oiResult.saved}, Failed: ${oiResult.failed}`);
    } catch (e) {
        console.error('[Backfill] OI sync failed:', e.message);
    }

    console.log('\n[Backfill] ALL DONE! New stocks are now populated.');
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
