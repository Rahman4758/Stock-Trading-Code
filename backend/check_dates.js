const mongoose = require('mongoose');
const DailyPrice = require('./src/models/DailyPrice');

(async () => {
    await mongoose.connect('mongodb://localhost:27017/institutional-edge');
    
    // Check records for Friday April 24
    const start = new Date('2026-04-24T00:00:00Z');
    const end = new Date('2026-04-24T23:59:59Z');
    
    const count = await DailyPrice.countDocuments({
        date: { $gte: start, $lte: end }
    });
    
    console.log(`April 24 Records: ${count}`);
    
    if (count > 0) {
        const sample = await DailyPrice.findOne({ date: { $gte: start, $lte: end } });
        console.log(`Sample: ${sample.symbol} at ${sample.date.toISOString()}`);
    } else {
        // If 0, check what dates we DO have
        const latest = await DailyPrice.findOne().sort({ date: -1 });
        console.log(`Latest record: ${latest?.symbol} at ${latest?.date.toISOString()}`);
        
        const allDates = await DailyPrice.distinct('date');
        console.log(`All available dates: ${allDates.map(d => d.toISOString()).join(', ')}`);
    }
    
    process.exit(0);
})();
