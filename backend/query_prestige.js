const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Stock-Trading-code/backend/src/.env' });

const MONGO_URI = "mongodb://localhost:27017/institutional-edge";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const symbol = "PRESTIGE";

        const SmartMoneyScore = mongoose.connection.collection('smartmoneyscores');
        const scores = await SmartMoneyScore.find({ symbol }).sort({ date: -1 }).limit(5).toArray();
        console.log("--- Smart Money Scores (Last 5 Days) ---");
        scores.forEach(s => {
            console.log(`[${s.date.toISOString().split('T')[0]}] compositeScore: ${s.compositeScore}`);
            console.log(`  Subscores: InstFlow=${s.scores?.institutionalFlow || 0}, Bulk=${s.scores?.bulkDeal || 0}, OI=${s.scores?.oiSignal || 0}, Delivery=${s.scores?.delivery || 0}, Hidden=${s.scores?.hiddenAccumulation || 0}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
