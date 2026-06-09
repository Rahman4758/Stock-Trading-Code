const mongoose = require('mongoose');
require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const DailyPrice = require('./src/models/DailyPrice');
const DailySnapshot = require('./src/models/DailySnapshot');

async function inspect() {
    try {
        await connectMongo();
        
        const symbol = 'KOTAKBANK';
        const date = new Date('2026-04-10');
        const start = new Date(date).setHours(0,0,0,0);
        const end = new Date(date).setHours(23,59,59,999);

        const price = await DailyPrice.findOne({ symbol, date: { $gte: start, $lte: end } }).lean();
        const snapshot = await DailySnapshot.findOne({ symbol, date: { $gte: start, $lte: end } }).lean();

        console.log(`--- ${symbol} data for ${date.toDateString()} ---`);
        console.log('DailyPrice:', JSON.stringify(price, null, 2));
        console.log('DailySnapshot:', JSON.stringify(snapshot, null, 2));

        const historicalPrices = await DailyPrice.find({ symbol }).sort({ date: -1 }).limit(10).lean();
        console.log('\n--- Historical Prices (last 10) ---');
        historicalPrices.forEach(p => console.log(`${p.date.toISOString().split('T')[0]}: Vol=${p.volume}, Close=${p.close}`));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

inspect();
