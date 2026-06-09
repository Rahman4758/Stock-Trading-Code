const mongoose = require('mongoose');
require('dotenv').config({path: 'src/.env'});
const strategy = require('./src/strategies/dynamicMomentumStrategy');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('Testing dynamic momentum strategy...');
    const results = await strategy.scan({ requirePriceAbove50DMA: true, minScore: 6 });
    console.log('Results length:', results.length);
    if (results.length > 0) {
        console.log('Top 5 results closes vs SMAs:');
        for (const r of results.slice(0, 5)) {
            const priceDocs = await DailyPrice.find({ symbol: r.symbol }).sort({ date: -1 }).limit(260).lean();
            const getSMA = (n) => priceDocs.length >= n ? priceDocs.slice(0, n).reduce((sum, p) => sum + p.close, 0) / n : null;
            const sma50 = priceDocs[0].sma50 || getSMA(50);
            console.log(`${r.symbol} - Close: ${r.close}, SMA50: ${sma50}`);
        }
    }
    process.exit(0);
}).catch(console.error);
