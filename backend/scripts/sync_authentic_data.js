require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const { connectMongo } = require('../src/config/db');
const DataSourceManager = require('../src/collectors/dataSourceManager');
const nseHistoricalService = require('../src/services/nseHistoricalService');
const SnapshotBuilder = require('../src/services/SnapshotBuilder');
const Stock = require('../src/models/Stock');

async function sync() {
    try {
        await connectMongo();
        console.log('--- Phase 1: Authentic Price History (Upstox) ---');
        const dataSource = new DataSourceManager('upstox');
        // 1. Index Price Sync
        await dataSource.collectPrices({ symbols: ['NIFTY 50', 'NIFTY BANK'], days: 60 });
        // 2. Stock Price Sync
        await dataSource.collectPrices({ days: 60 });
        
        console.log('\n--- Phase 2: Authentic Delivery Data (NSE BhavCopy 3-Day Backfill) ---');
        const tradingDays = [
            new Date('2026-04-10T12:00:00Z'), // Friday
            new Date('2026-04-09T12:00:00Z'), // Thursday
            new Date('2026-04-08T12:00:00Z')  // Wednesday
        ];

        for (const date of tradingDays) {
            console.log(`\nSyncing Delivery for ${date.toDateString()}...`);
            await nseHistoricalService.syncDeliveryData(date);
        }
        
        console.log('\n--- Phase 3: Rebuilding Snapshots ---');
        const stocks = await Stock.find({ isActive: true }).select('symbol').lean();
        
        for (const date of tradingDays) {
            console.log(`Building Snapshots for ${date.toDateString()}...`);
            let built = 0;
            for (const stock of stocks) {
                const snap = await SnapshotBuilder.buildSnapshotForSymbol(stock.symbol, date);
                if (snap) built++;
            }
            console.log(`✅ Built ${built} snapshots for ${date.toDateString()}`);
        }
        
        console.log(`\n✅ SYNC COMPLETE! All snapshots rebuilt with authentic data.`);
        
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

sync();
