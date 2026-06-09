const mongoose = require('mongoose');
const NsePuppeteerCollector = require('./src/collectors/nsePuppeteer');
const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: 'src/.env' });

async function runBackfill() {
    console.log('Starting FII/DII Data Backfill (3 Days)...');
    
    try {
        await connectMongo();
        console.log('Connected to MongoDB');

        const collector = new NsePuppeteerCollector();
        
        await collector.collectFiiDii({ days: 3 });

        console.log('FII/DII Backfill complete!');
    } catch (err) {
        console.error('Backfill failed:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

runBackfill();
