const mongoose = require('mongoose');
const dns = require('dns');
const StockSelector = require('./src/core/stockSelector');
const Stock = require('./src/models/Stock');
const DailyPrice = require('./src/models/DailyPrice');
const SmartMoneyScore = require('./src/models/SmartMoneyScore');
const divergenceDetector = require('./src/services/divergenceDetector');

// Force DNS fix for Windows SRV issues
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

async function backfillAnalysis() {
    console.log('🚀 Starting Analysis Backfill...');
    
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const stocks = await Stock.find({ isActive: true }).lean();
        console.log(`📊 Processing ${stocks.length} stocks for backfill...`);

        // Get the last 15 trading days
        const distinctDates = await DailyPrice.distinct('date');
        const sortedDates = distinctDates.sort((a, b) => b - a).slice(0, 15);
        
        console.log(`📅 Backfilling for ${sortedDates.length} days: ${sortedDates[sortedDates.length-1].toISOString().split('T')[0]} to ${sortedDates[0].toISOString().split('T')[0]}`);

        for (const date of sortedDates.reverse()) { // Oldest first
            console.log(`\n⏳ Analyzing date: ${date.toISOString().split('T')[0]}...`);
            
            for (const stock of stocks) {
                try {
                    const analysis = await StockSelector.analyzeStock(stock.symbol, stock.sectorIndex, date);
                    if (!analysis) continue;

                    // Save score to DB
                    await SmartMoneyScore.findOneAndUpdate(
                        { symbol: stock.symbol, date: analysis.targetDate },
                        {
                            $set: {
                                symbol: stock.symbol,
                                date: analysis.targetDate,
                                scores: analysis.scores.components,
                                compositeScore: analysis.compositeScore,
                                interpretation: analysis.recommendation.action,
                                confidence: analysis.recommendation.confidence,
                            }
                        },
                        { upsert: true }
                    );

                    // Check for divergences
                    await divergenceDetector.detect(stock.symbol, analysis.targetDate);
                    
                } catch (err) {
                    // console.error(`[Backfill] Failed ${stock.symbol} on ${date.toISOString().split('T')[0]}: ${err.message}`);
                }
            }
            process.stdout.write('.');
        }

        console.log('\n\n🎉 Analysis Backfill Complete!');
    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

backfillAnalysis();
