const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Stock-Trading-code/backend/src/.env' });
const SwingScanner = require('./src/services/SwingScanner');

const MONGO_URI = "mongodb://localhost:27017/institutional-edge";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const res = await SwingScanner.layer1Filter();
        console.log(`Passed: ${res.passed ? res.passed.length : 0}`);
        if (res.passed && res.passed.length === 0) {
            console.log("Investigating why 0...");
            const latestDoc = await mongoose.connection.db.collection('dailyprices').findOne({}, { sort: { date: -1 } });
            console.log(`Latest date: ${latestDoc.date}`);
            
            const candidates = await mongoose.connection.db.collection('dailyprices').find({
                date: latestDoc.date,
                close: { $gte: 50 },
                deliveryPct: { $gte: 38 }
            }).toArray();
            console.log(`Candidates matching Price >= 50 and Delivery >= 38: ${candidates.length}`);
            
            if (candidates.length > 0) {
                const symbols = candidates.map(c => c.symbol);
                const latestOi = await mongoose.connection.db.collection('oidatas').find({
                    symbol: { $in: symbols },
                    oiSignal: { $in: ['LONG_BUILDUP', 'SHORT_COVERING', 'NEUTRAL'] }
                }).sort({ date: -1 }).toArray();
                console.log(`Matching OI records found: ${latestOi.length}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
