const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Stock-Trading-code/backend/src/.env' });
const ConvictionService = require('./src/services/ConvictionService');
const priceRepo = require('./src/repositories/PriceRepository');

const MONGO_URI = "mongodb://localhost:27017/institutional-edge";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const symbol = "PRESTIGE";
        
        const dates = [
            new Date("2026-06-11"),
            new Date("2026-06-12"),
            new Date("2026-06-15"),
            new Date("2026-06-16"),
            new Date("2026-06-17")
        ];

        console.log("\n--- HISTORICAL SCORES WITH NEW LOGIC ---");
        for (const date of dates) {
            const allPrices = await priceRepo.getRange(symbol, new Date("2020-01-01"), date);
            console.log(`Fetched ${allPrices.length} prices for ${date.toISOString()}`);
            const result = await ConvictionService.compute(symbol, 20, date, allPrices, false);
            console.log(`[${date.toISOString().split('T')[0]}] Score: ${result.compositeScore}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
