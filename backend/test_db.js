const mongoose = require('mongoose');
const DailyPrice = require('./src/models/DailyPrice');
const OiData = require('./src/models/OiData');

mongoose.connect('mongodb://localhost:27017/institutional-edge').then(async () => {
    const latestDoc = await DailyPrice.findOne({ deliveryPct: { $gt: 0 } }).sort({ date: -1 }).lean();
    const latestDate = latestDoc.date;
    const candidates = await DailyPrice.find({ date: latestDate, close: { $gte: 50 }, deliveryPct: { $gte: 38 } }).lean();
    
    const symbols = candidates.map(c => c.symbol);
    const latestOi = await OiData.find({
        symbol: { $in: symbols },
        oiSignal: { $in: ['LONG_BUILDUP', 'SHORT_COVERING', 'NEUTRAL'] }
    }).sort({ date: -1 }).select('symbol oiSignal futureOi pcr').lean();
    
    const oiOkSymbols = new Set(latestOi.map(o => o.symbol));
    const passed = candidates.filter(c => oiOkSymbols.has(c.symbol));
    
    console.log("Candidates:", candidates.length);
    console.log("OI OK Symbols:", oiOkSymbols.size);
    console.log("Passed:", passed.length);

    if (oiOkSymbols.size === 0) {
        console.log("Why are there no OI matching symbols?");
        const sampleOi = await OiData.find({ symbol: { $in: symbols } }).sort({ date: -1 }).limit(10).lean();
        console.log(sampleOi);
    }
    
    process.exit();
});
