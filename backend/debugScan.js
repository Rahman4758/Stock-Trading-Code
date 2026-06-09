const mongoose = require('mongoose');
const StockSelector = require('./src/core/stockSelector');
const DailyPrice = require('./src/models/DailyPrice');
const AccumulationAnalyzer = require('./src/services/accumulationAnalyzer');

async function debug() {
    await mongoose.connect('mongodb://localhost:27017/institutional-edge');
    console.log('Connected to MongoDB');

    const symbol = 'RELIANCE';
    
    const smartMoney = await AccumulationAnalyzer.calculateAccumulationScore(symbol);
    console.log(`\n--- ${symbol} Accumulation Breakdown ---`);
    console.log(JSON.stringify(smartMoney, null, 2));

    const latestPriceDoc = await DailyPrice.findOne({ symbol }).sort({ date: -1 }).lean();
    if (latestPriceDoc) {
        const analyses = await StockSelector.analyzeStock(symbol, 'NIFTY50', latestPriceDoc.date);
        console.log(`\n--- ${symbol} Strategy Analysis ---`);
        console.log(JSON.stringify(analyses, null, 2));
    } else {
        console.log('No price data found for RELIANCE');
    }

    process.exit(0);
}

debug().catch(console.error);
