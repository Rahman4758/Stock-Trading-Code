require('dotenv').config({ path: './src/.env' });
const { connectMongo, redisClient } = require('./src/config/db');
const StockSelector = require('./src/core/stockSelector');

async function run() {
    await connectMongo();
    try { await redisClient.connect(); } catch (e) { }

    for (let i = 5; i >= 1; i--) {
        const d = new Date('2026-06-06T12:00:00Z');
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        
        console.log(`\nScanning for ${d.toISOString().split('T')[0]}...`);
        const results = await StockSelector.scanUniverse(d);
        console.log(`Found ${results.length} signals.`);
    }

    if (redisClient.isOpen) {
        await redisClient.flushall();
        console.log('Redis cache cleared!');
    }
    
    process.exit(0);
}

run();
