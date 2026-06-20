const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Stock-Trading-code/backend/src/.env' });
const ConvictionService = require('./src/services/ConvictionService');

const MONGO_URI = "mongodb://localhost:27017/institutional-edge";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const symbol = "PRESTIGE";
        
        // Let's compute the score for today/latest
        const result = await ConvictionService.compute(symbol, 20, null, null, false); // persist=false
        console.log("\n--- NEW SCORE FOR PRESTIGE ---");
        console.log(`Composite Score: ${result.compositeScore}`);
        console.log(`Subscores:`, result.scores);
        console.log(`Interpretation: ${result.interpretation}`);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
