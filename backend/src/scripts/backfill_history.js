require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectMongo } = require('../config/db');
const Stock = require('../models/Stock');
const DailyPrice = require('../models/DailyPrice');
const NsePuppeteerCollector = require('../collectors/nsePuppeteer');

/**
 * Script to ensure all active F&O stocks have at least ~100 trading days of history.
 * We fetch 150 calendar days to account for weekends/holidays.
 */
async function backfillMissingHistory() {
    console.log('Connecting to MongoDB...');
    await connectMongo();

    console.log('Initializing NSE Puppeteer...');
    const nse = new NsePuppeteerCollector();
    await nse.init();

    try {
        const stocks = await Stock.find({ isActive: true }).select('symbol').lean();
        console.log(`Found ${stocks.length} active stocks. Checking historical data integrity...`);

        let missingCount = 0;

        for (const stock of stocks) {
            const count = await DailyPrice.countDocuments({ symbol: stock.symbol });
            
            // Engines now require minimum 100 trading days
            if (count < 100) {
                missingCount++;
                console.log(`\n[BACKFILL] ${stock.symbol} only has ${count} days of data. Required: 100+. Syncing 150 calendar days...`);
                
                try {
                    // Fetch 150 calendar days to ensure we get >100 trading days
                    await nse.syncHistoryForStock(stock.symbol, 150);
                    // Add a small delay between macroscopic stock requests to respect NSE rate limits
                    await new Promise(r => setTimeout(r, 2000));
                } catch (err) {
                    console.error(`[ERROR] Failed to sync ${stock.symbol}:`, err.message);
                }
            }
        }

        console.log(`\nBackfill complete. Synced data for ${missingCount} stocks out of ${stocks.length}.`);
    } catch (err) {
        console.error('Fatal error during backfill:', err);
    } finally {
        await nse.close();
        await mongoose.disconnect();
        console.log('Disconnected from DB.');
    }
}

backfillMissingHistory();
