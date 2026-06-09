const mongoose = require('mongoose');
const NsePuppeteerCollector = require('./src/collectors/nsePuppeteer');
const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: 'src/.env' });

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function runBackfill() {
    console.log('Starting FII/DII Data Backfill (30 Days)...');
    
    try {
        await connectMongo();
        console.log('Connected to MongoDB');

        const collector = new NsePuppeteerCollector();
        
        // This method in the collector automatically fetches and saves 
        // participant data for the specified day range.
        // It handles date formatting and upserts internally.
        await collector.collectFiiDii({ days: 30 });

        console.log('FII/DII Backfill complete!');
    } catch (err) {
        console.error('Backfill failed:', err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

runBackfill();
