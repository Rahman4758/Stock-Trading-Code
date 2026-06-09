const mongoose = require('mongoose');
const SectorCollector = require('./src/collectors/SectorCollector');
const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: 'src/.env' });

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function runBackfill() {
    console.log('Starting Nifty & Sector Index Historical Sync (60 Days)...');
    
    try {
        await connectMongo();
        console.log('Connected to MongoDB');

        const collector = new SectorCollector();
        
        // syncHistory(60) will pull data from 60 days ago to today
        // This covers the gap between March 31 and April 7.
        await collector.syncHistory(60);

        console.log('Historical Index Sync complete!');
    } catch (err) {
        console.error('Backfill failed:', err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

runBackfill();
