const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const EventCalendar = require('./src/models/EventCalendar');
const SnapshotBuilder = require('./src/services/SnapshotBuilder');
const MarketDataService = require('./src/services/MarketDataService');
const DailySnapshot = require('./src/models/DailySnapshot');

async function run() {
    await connectMongo();
    
    const latestDate = await MarketDataService.getLatestTradingDate();
    if (!latestDate) {
        console.error('No trading data found.');
        process.exit(1);
    }
    
    console.log('Purging old snapshots to ensure 100% data integrity...');
    await DailySnapshot.deleteMany({});
    
    console.log('Hydrating Real Trading-Day History (Last 20 Days)...');
    
    const symbols = await EventCalendar.find({ is_active_monitoring: true }).distinct('symbol');
    console.log('Symbols to process:', symbols.length);
    
    for (const symbol of symbols) {
        process.stdout.write(`Hydrating ${symbol}... `);
        let saved = 0;
        // Look back 30 calendar days to find at least 15 trading days
        for (let i = 0; i < 30; i++) {
            const targetDate = new Date(latestDate);
            targetDate.setDate(targetDate.getDate() - i);
            
            // Skip weekends (0 = Sunday, 6 = Saturday)
            const day = targetDate.getDay();
            if (day === 0 || day === 6) continue;

            targetDate.setUTCHours(12,0,0,0);
            const result = await SnapshotBuilder.buildSnapshotForSymbol(symbol, targetDate);
            if (result) saved++;
            
            if (saved >= 15) break; // We have enough for the UI
        }
        console.log(`Done (${saved} days saved).`);
    }
    
    console.log('\n--- HYDRATION COMPLETE ---');
    console.log('All weekend data removed. Only real trading sessions preserved.');
    process.exit(0);
}

run();
