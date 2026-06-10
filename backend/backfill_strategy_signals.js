require('dotenv').config({ path: 'src/.env' });
const mongoose = require('mongoose');
const SwingScanResult = require('./src/models/SwingScanResult');
const StrategySignal = require('./src/models/StrategySignal');

async function backfillSignals() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const buyResults = await SwingScanResult.find({
            action: { $in: ['BUY', 'STRONG BUY'] }
        });

        console.log(`Found ${buyResults.length} existing BUY signals. Backfilling into StrategySignal...`);

        let added = 0;
        for (const res of buyResults) {
            try {
                const exists = await StrategySignal.findOne({
                    symbol: res.symbol,
                    strategyName: 'FEDERAL_BANK_SWING',
                    entryDate: res.date
                });

                if (!exists) {
                    await StrategySignal.create({
                        symbol: res.symbol,
                        strategyName: 'FEDERAL_BANK_SWING',
                        entryDate: res.date,
                        entryPrice: res.currentPrice,
                        stopLoss: res.stopLoss || (res.currentPrice * 0.95),
                        target1: res.target1 || (res.currentPrice * 1.05),
                        target2: res.target2 || (res.currentPrice * 1.10),
                        target3: res.target3 || (res.currentPrice * 1.15),
                        highestPrice: res.currentPrice,
                        lowestPrice: res.currentPrice,
                        status: 'ACTIVE',
                        algoScore: res.layer2Score || 0,
                        confidence: res.confidence || 'LOW'
                    });
                    console.log(`Added missing signal for ${res.symbol}`);
                    added++;
                } else {
                    console.log(`Signal for ${res.symbol} already tracked.`);
                }
            } catch (e) {
                console.error(`Failed to add ${res.symbol}:`, e.message);
            }
        }

        console.log(`\nBackfill complete. Added ${added} missing signals to tracking.`);
        process.exit(0);
    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    }
}

backfillSignals();
