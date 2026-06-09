require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const { connectMongo } = require('../src/config/db');
const DailyPrice = require('../src/models/DailyPrice');
const DailySnapshot = require('../src/models/DailySnapshot');

async function cleanup() {
    try {
        await connectMongo();
        
        console.log('--- Cleaning Invalid Authentic Data ---');
        
        // 1. Delete DailyPrice records where volume is 0 (invalid for institutional metrics)
        const priceResult = await DailyPrice.deleteMany({ volume: 0 });
        console.log(`🗑️  Deleted ${priceResult.deletedCount} corrupted price records (Volume=0).`);

        // 2. Delete DailySnapshot records where volume_ratio is 0 or delivery_pct is 0 
        // to force a clean rebuild with the new hardened collectors.
        const snapResult = await DailySnapshot.deleteMany({ 
            $or: [
                { volume_ratio: 0 },
                { delivery_pct: 0 }
            ] 
        });
        console.log(`🗑️  Deleted ${snapResult.deletedCount} incomplete snapshots.`);

        console.log('--- Cleanup Complete ---');
        
    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

cleanup();
