const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const UpstoxCollector = require('./src/collectors/upstoxCollector');
const Stock = require('./src/models/Stock');

async function run() {
    await connectMongo();
    
    console.log('Fetching 90 days of historical prices for ALL active F&O stocks...');
    const collector = new UpstoxCollector();
    if (!collector.isConfigured()) {
        console.error('Upstox is not configured. Historical fetch requires Upstox API.');
        process.exit(1);
    }

    try {
        await collector.collectPrices({ days: 90 });
        console.log('\n--- PRICE FETCH COMPLETE ---');
    } catch (err) {
        console.error(`Failed: ${err.message}`);
    }

    process.exit(0);
}

run();
