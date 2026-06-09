const mongoose = require('mongoose');
require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const DailySnapshot = require('./src/models/DailySnapshot');

async function verify() {
    await connectMongo();
    
    // Find latest snapshots with actual data
    const validSnaps = await DailySnapshot.find({ 
        volume_ratio: { $gt: 0 },
        delivery_pct: { $gt: 0 }
    }).sort({ date: -1 }).limit(5).lean();

    console.log(`Found ${validSnaps.length} valid snapshots with non-zero metrics.`);
    if (validSnaps.length > 0) {
        validSnaps.forEach(s => {
            console.log(`${s.date.toISOString().split('T')[0]} | ${s.symbol} | Vol Ratio: ${s.volume_ratio} | Del %: ${s.delivery_pct} | VWAP: ${s.vwap_position}`);
        });
    } else {
        console.log('❌ Still no valid snapshots found with non-zero metrics.');
    }

    process.exit(0);
}

verify();
