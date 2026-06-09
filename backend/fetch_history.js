const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const Stock = require('./src/models/Stock');
const MarketDataService = require('./src/services/MarketDataService');
const DailyPrice = require('./src/models/DailyPrice');

async function run() {
    await connectMongo();
    
    console.log('Fetching 30-day historical prices for Top 60 Stocks...');
    
    const stocks = await Stock.find({ isFno: true }).select('symbol');
    console.log('Stocks to fetch:', stocks.length);
    
    for (const stock of stocks) {
        process.stdout.write(`Fetching ${stock.symbol}... `);
        try {
            // This service should use the Upstox API to fetch historical candles
            const count = await MarketDataService.fetchHistoricalData(stock.symbol, 30);
            console.log(`Success (${count} candles saved).`);
        } catch (err) {
            console.log(`Failed: ${err.message}`);
        }
    }
    
    console.log('\n--- PRICE FETCH COMPLETE ---');
    process.exit(0);
}

run();
