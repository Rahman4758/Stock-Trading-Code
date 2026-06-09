require('dotenv').config({ path: './src/.env' });
const { connectMongo, redisClient } = require('./src/config/db');
const StockSelector = require('./src/core/stockSelector');
const MarketDataService = require('./src/services/MarketDataService');

async function run() {
    console.log('Force re-scanning the entire 210 stock universe for the last VALID trading day...');
    
    await connectMongo();
    try { await redisClient.connect(); } catch (e) { console.log('Redis omitted'); }
    
    try {
        // Find the most recent Friday (June 5th) because June 6th is Saturday
        const targetDate = new Date('2026-06-05T12:00:00Z');
        
        const results = await StockSelector.scanUniverse(targetDate);
        console.log(`Scan completed successfully! Generated ${results ? results.length : 0} signals for ${targetDate.toISOString().split('T')[0]}.`);
        
        if (redisClient.isOpen) {
            await redisClient.del('scan:latest');
            await redisClient.del('radar:active');
            await redisClient.del('radar:history');
            const divKeys = await redisClient.keys('scan:divergences:*');
            if (divKeys && divKeys.length > 0) {
                await redisClient.del(divKeys);
            }
            console.log('Redis cache cleared. New stocks should now appear in the frontend!');
        }
    } catch (err) {
        console.error('Scan Failed:', err);
    }
    
    process.exit(0);
}

run();
