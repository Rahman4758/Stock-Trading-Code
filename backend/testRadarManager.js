require('dotenv').config({ path: './src/.env' });
const { connectMongo, redisClient } = require('./src/config/db');
const stockSelector = require('./src/core/stockSelector');
const ActiveRadar = require('./src/models/ActiveRadar');

const test = async () => {
    console.log('Connecting to DB...');
    await connectMongo();
    try { await redisClient.connect(); } catch {}
    
    console.log('\nRunning Scanner to Feed Radar...');
    const results = await stockSelector.scanUniverse();

    console.log(`\nScan complete. ${results.length} stocks processed.`);
    
    // Check top 5
    console.log('Top 5 Stocks from Scan:');
    const top5 = results.slice(0, 5).map(r => ({ symbol: r.symbol, inst: r.institutionalScore, tech: r.technicalScore, final: r.finalScore }));
    console.table(top5);

    console.log('\nActive Radar DB state:');
    const radar = await ActiveRadar.find().select('symbol status highestScore stopLoss').lean();
    console.table(radar);
    
    process.exit(0);
};

test().catch(err => {
    console.error(err);
    process.exit(1);
});
