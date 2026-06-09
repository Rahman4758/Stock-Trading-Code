const mongoose = require('mongoose');
const DailyPrice = require('./src/models/DailyPrice');
const StockSelector = require('./src/core/stockSelector');
const Stock = require('./src/models/Stock');

async function verify() {
    console.log('=== Compression-Release Strategy Verification ===\n');
    
    await mongoose.connect('mongodb://localhost:27017/institutional-edge');
    console.log('Connected to MongoDB');

    const symbol = 'HINDALCO';
    const sector = 'NIFTY_METAL';

    // 1. Ensure Stock exists
    await Stock.findOneAndUpdate(
        { symbol },
        { symbol, sectorIndex: sector, isActive: true },
        { upsert: true }
    );

    // 2. Seed Pattern Data (Last 60 days)
    // P1: Consolidation (Range 875-960)
    // P2: Shakeout (~825)
    // P3: Ignition (Big green, high vol)
    
    await DailyPrice.deleteMany({ symbol });
    
    const baseDate = new Date('2026-04-20');
    const prices = [];

    // Phase 1 & 2: Consolidation for 55 days
    for (let i = 60; i > 5; i--) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - i);
        prices.push({
            symbol,
            date,
            open: 900 + Math.random() * 10,
            high: 920 + Math.random() * 10,
            low: 880 + Math.random() * 10,
            close: 900 + Math.random() * 10,
            volume: 1000000 + Math.random() * 500000,
            deliveryPercentage: 45
        });
    }

    // Phase 2: Shakeout (Day -5 to -3)
    const shakeoutDate = new Date(baseDate);
    shakeoutDate.setDate(shakeoutDate.getDate() - 3);
    prices.push({
        symbol,
        date: shakeoutDate,
        open: 880,
        high: 890,
        low: 825, // THE SHAKEOUT
        close: 840,
        volume: 2000000,
        deliveryPercentage: 30
    });

    // Phase 3: Recovery/Ignition (Day -2)
    const recoveryDate = new Date(baseDate);
    recoveryDate.setDate(recoveryDate.getDate() - 2);
    prices.push({
        symbol,
        date: recoveryDate,
        open: 850,
        high: 950,
        low: 850,
        close: 940, // Big body
        volume: 5000000, // High volume (5x avg)
        deliveryPercentage: 70 // High delivery
    });

    // Phase 4: Expansion (Day -1)
    const expansionDate = new Date(baseDate);
    expansionDate.setDate(expansionDate.getDate() - 1);
    prices.push({
        symbol,
        date: expansionDate,
        open: 945,
        high: 1020,
        low: 940,
        close: 1010,
        volume: 6000000,
        deliveryPercentage: 65
    });

    await DailyPrice.insertMany(prices);
    console.log(`Seeded ${prices.length} price records for ${symbol}`);

    // 3. Run Analysis
    console.log('\nRunning StockSelector.analyzeStock...');
    const results = await StockSelector.analyzeStock(symbol, sector, expansionDate);

    console.log('\n--- Analysis Results ---');
    console.log(JSON.stringify(results, null, 2));

    const crSetup = results.find(r => r.setupType === 'COMPRESSION_RELEASE');
    if (crSetup) {
        console.log(`\n✅ SUCCESS: Compression-Release setup detected with Grade ${crSetup.grade}!`);
        console.log(`Score: ${crSetup.finalScore}`);
    } else {
        console.log('\n❌ FAILED: Compression-Release setup NOT detected.');
    }

    await mongoose.disconnect();
}

verify().catch(console.error);
