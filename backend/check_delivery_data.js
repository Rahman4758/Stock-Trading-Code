const mongoose = require('mongoose');
const DailyPrice = require('./src/models/DailyPrice');
const DailySnapshot = require('./src/models/DailySnapshot');
const { connectMongo } = require('./src/config/db');

async function check() {
    try {
        await connectMongo();
        
        const priceCount = await DailyPrice.countDocuments();
        const priceWithDeliv = await DailyPrice.countDocuments({ deliveryPct: { $gt: 0 } });
        
        const snapCount = await DailySnapshot.countDocuments();
        const snapWithDeliv = await DailySnapshot.countDocuments({ delivery_pct: { $gt: 0 } });
        
        console.log('--- DB Statistics ---');
        console.log(`DailyPrice: Total=${priceCount}, With deliveryPct>0=${priceWithDeliv}`);
        console.log(`DailySnapshot: Total=${snapCount}, With delivery_pct>0=${snapWithDeliv}`);
        
        if (snapCount > 0) {
            const sampleSnap = await DailySnapshot.findOne().sort({ date: -1 }).lean();
            console.log('\nSample Snapshot:', JSON.stringify(sampleSnap, null, 2));
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
