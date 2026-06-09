const dns = require('dns');
// Force Google DNS to fix Windows SRV lookup issue with mongodb+srv://
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const MacroCollector = require('./src/collectors/MacroCollector');
require('dotenv').config({ path: 'src/.env' });

const { connectMongo } = require('./src/config/db');

async function runBackfill() {
    const daysArg = Number(process.argv[2]);
    const days = Number.isFinite(daysArg) && daysArg > 0 ? Math.min(Math.round(daysArg), 3650) : 365;
    console.log('Starting Macro Data Backfill...');
    
    try {
        await connectMongo();
        console.log('Connected to MongoDB');

        const collector = new MacroCollector();
        
        // 1. Fetch Today's Data
        await collector.collect();
        
        // 2. Fetch historical data window
        await collector.backfill(days);

        console.log(`Backfill process complete for ${days} days!`);
    } catch (err) {
        console.error('Backfill failed:', err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

runBackfill();
