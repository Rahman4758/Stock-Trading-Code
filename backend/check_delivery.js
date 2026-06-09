require('dotenv').config({ path: 'src/.env' });
const { connectMongo } = require('./src/config/db');
const DP = require('./src/models/DailyPrice');
const DS = require('./src/models/DailySnapshot');

connectMongo().then(async () => {
    const dp = await DP.find({symbol: {$in: ['BRITANNIA', 'BHARTIARTL']}}).sort({date: -1}).limit(6).lean();
    const ds = await DS.find({symbol: {$in: ['BRITANNIA', 'BHARTIARTL']}}).sort({date: -1}).limit(4).lean();
    console.log('DailyPrice:', dp.map(x => ({symbol: x.symbol, date: x.date, deliveryPct: x.deliveryPct})));
    console.log('DailySnapshot:', ds.map(x => ({symbol: x.symbol, date: x.date, delivery_pct: x.delivery_pct})));
    process.exit(0);
});
