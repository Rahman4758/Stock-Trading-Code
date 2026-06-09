const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

async function debugScores() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const SmartMoneyScore = require('./src/models/SmartMoneyScore');
        const Stock = require('./src/models/Stock');

        const latestPriceDate = await require('./src/models/DailyPrice').findOne().sort({ date: -1 }).select('date').lean();
        const date = latestPriceDate.date;

        const allScores = await SmartMoneyScore.find({ date }).sort({ compositeScore: -1 }).lean();
        
        console.log(`\n--- Top 10 Scores on ${date.toISOString().split('T')[0]} ---`);
        for (const s of allScores.slice(0, 10)) {
            const stock = await Stock.findOne({ symbol: s.symbol }).lean();
            console.log(`${s.symbol} (${stock?.name}): ${s.compositeScore}`);
            console.log(`  - FII: ${s.scores.institutionalFlow}, Bulk: ${s.scores.bulkDeal}, OI: ${s.scores.oiSignal}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

debugScores();
