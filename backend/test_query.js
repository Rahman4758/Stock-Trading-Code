require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const DailyPrice = require('./src/models/DailyPrice');

async function run() {
    await connectMongo();
    const start = new Date(Date.UTC(2026, 5, 5, 0,0,0,0));
    const end = new Date(Date.UTC(2026, 5, 5, 23,59,59,999));
    const res = await DailyPrice.findOneAndUpdate(
        { symbol: 'RELIANCE', date: { $gte: start, $lte: end } },
        { $set: { deliveryPct: 42.0 } },
        { new: true }
    );
    console.log(res ? 'Updated ' + res.symbol : 'Not found');
    process.exit(0);
}
run();
