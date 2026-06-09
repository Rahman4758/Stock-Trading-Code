require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const DailyPrice = require('./src/models/DailyPrice');

async function test() {
    await connectMongo();
    
    const count = await DailyPrice.countDocuments({
        date: { $gte: new Date('2026-06-05T00:00:00.000Z'), $lte: new Date('2026-06-05T23:59:59.000Z') }
    });
    console.log('Prices on June 5 UTC:', count);
    
    // Check local time matching used in bulk_delivery_backfill
    const date = new Date('2026-06-05T10:00:00.000Z'); // Represents June 5
    const localStart = new Date(date).setHours(0,0,0,0);
    const localEnd = new Date(date).setHours(23,59,59,999);
    
    const countLocal = await DailyPrice.countDocuments({
        date: { $gte: localStart, $lte: localEnd }
    });
    console.log('Prices on June 5 Local Matching:', countLocal);

    process.exit(0);
}
test();
