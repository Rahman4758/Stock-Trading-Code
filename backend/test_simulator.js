require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

const stockSelector = require('../core/stockSelector');
const DailyPrice = require('../models/DailyPrice');

async function debugBacktest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected. Running Debugger on RELIANCE for latest 20 trading days...');

        const symbol = 'RELIANCE';
        const dates = await DailyPrice.find({ symbol }).sort({ date: -1 }).limit(20).select('date').lean();
        
        for (const record of dates) {
            const date = record.date;
            const analysis = await stockSelector.analyzeStock(symbol, 'NIFTY50', date, true);
            
            if (!analysis) {
                console.log(`${date.toISOString().split('T')[0]} : NULL Analysis (Probably Insufficient Data)`);
                continue;
            }

            console.log(`\n📅 ${date.toISOString().split('T')[0]} | Price: ${analysis.currentPrice}`);
            console.log(`Inst Score: ${analysis.institutionalScore} | Tech Score: ${analysis.technicalScore}`);
            console.log(`Final: ${analysis.finalScore} | Grade: ${analysis.grade}`);
            console.log(`Flags: ${analysis.flags.join(', ')}`);
        }
        
    } catch(e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}
debugBacktest();
