const mongoose = require('mongoose');
require('dotenv').config({path: 'src/.env'});
const DailyPrice = require('./src/models/DailyPrice');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Stock = require('./src/models/Stock');
    const stocks = await Stock.find({ isActive: true }).select('symbol').lean();
    let nanCount = 0;
    for (const s of stocks) {
        const priceDocs = await DailyPrice.find({ symbol: s.symbol }).sort({ date: -1 }).limit(260).lean();
        if(priceDocs.length < 50) continue;
        const getSMA = (n) => priceDocs.length >= n ? priceDocs.slice(0, n).reduce((sum, p) => sum + p.close, 0) / n : null;
        const sma50 = getSMA(50);
        if (isNaN(sma50) || sma50 === null) {
            console.log(s.symbol, 'has NaN or null SMA50');
            nanCount++;
        }
    }
    console.log('Total NaN SMA50:', nanCount);
    process.exit(0);
}).catch(console.error);
