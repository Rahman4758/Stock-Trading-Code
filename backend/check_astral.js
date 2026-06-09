require('dotenv').config({ path: './src/.env' });
require('./src/config/db').connectMongo().then(async () => {
  const DailyPrice = require('./src/models/DailyPrice');
  const docs = await DailyPrice.find({
      symbol: 'ASTRAL',
      date: { $gte: new Date('2026-02-20'), $lte: new Date('2026-03-30') }
  }).sort({date: 1}).lean();
  console.log(docs.map(d=>`${d.date.toISOString().split('T')[0]}: O=${d.open} H=${d.high} L=${d.low} C=${d.close} V=${d.volume}`));
  process.exit(0);
});
