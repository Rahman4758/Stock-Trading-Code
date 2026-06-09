const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const Stock = require('./src/models/Stock');
const EventCalendar = require('./src/models/EventCalendar');

const TOP_60_FNO = [
    'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDALCO', 'TATASTEEL', 'SBIN', 'BHARTIARTL', 'ITC', 
    'AXISBANK', 'KOTAKBANK', 'LT', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'TITAN', 'HINDUNILVR', 'ASIANPAINT', 'M&M', 
    'ADANIENT', 'ADANIPORTS', 'HCLTECH', 'ONGC', 'NTPC', 'JSWSTEEL', 'POWERGRID', 'TATACHEM', 'TATAMOTORS', 'GRASIM', 
    'ULTRACEMCO', 'NESTLEIND', 'COALINDIA', 'BAJAJFINSV', 'APOLLOHOSP', 'TECHM', 'INDUSINDBK', 'BRITANNIA', 'EICHERMOT', 'DRREDDY', 
    'CIPLA', 'DIVISLAB', 'BPCL', 'HEROMOTOCO', 'SBILIFE', 'HDFCLIFE', 'WIPRO', 'BAJAJ-AUTO', 'TATACONSUM', 'UPL', 
    'DLF', 'CHOLAFIN', 'LTIM', 'VEDL', 'PIIND', 'TRENT', 'TVSMOTOR', 'HAL', 'BEL', 'CUMMINSIND'
];

async function run() {
    await connectMongo();
    
    console.log('Restricting universe to Top 60 F&O stocks...');
    
    // 1. Reset all isFno flags
    await Stock.updateMany({}, { $set: { isFno: false } });
    
    // 2. Set isFno for Top 60
    const result = await Stock.updateMany(
        { symbol: { $in: TOP_60_FNO } },
        { $set: { isFno: true, isActive: true } }
    );
    console.log(`Updated ${result.modifiedCount} stocks to Prime F&O status.`);

    // 3. Cleanup EventCalendar: Remove any event not in our Top 60
    const cleanup = await EventCalendar.deleteMany({ symbol: { $nin: TOP_60_FNO } });
    console.log(`Removed ${cleanup.deletedCount} non-priority events from Radar.`);

    process.exit(0);
}

run();
