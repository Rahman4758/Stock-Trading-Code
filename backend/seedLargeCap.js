require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const dns = require('dns');
const Stock = require('./src/models/Stock');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

const topStocks = [
    // Nifty 50 constituents
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "ITC", "SBIN", "BHARTIARTL", 
    "BAJFINANCE", "LARSEN", "KOTAKBANK", "HCLTECH", "LT", "AXISBANK", "MARUTI", "SUNPHARMA",
    "ULTRACEMCO", "TATAMOTORS", "TITAN", "NTPC", "ASIANPAINT", "TATASTEEL", "POWERGRID",
    "BAJAJFINSV", "M&M", "ADANIENT", "HINDUNILVR", "COALINDIA", "BAJAJ-AUTO", "ONGC",
    "HINDALCO", "GRASIM", "TECHM", "WIPRO", "ADANIPORTS", "SBILIFE", "DRREDDY", "APOLLOHOSP",
    "INDUSINDBK", "EICHERMOT", "BRITANNIA", "CIPLA", "DIVISLAB", "TRENT", "NESTLEIND", "TATACONSUM",
    "HEROMOTOCO", "SHRIRAMFIN", "BPCL", "JSWSTEEL", "HDFCLIFE",
    // Top highly liquid Large Cap F&O additions (Nifty Next 50 heavyweights)
    "CHOLAFIN", "TVSMOTOR", "HAL", "BEL", "INDIGO", "PIDILITIND", "GAIL", "AMBUJACEM", "PFC", "RECLTD"
];

async function seed() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI not defined in .env. Ensure your .env file is present and proper.");
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to Trading Database');
        
        // Deactivate all stocks first to clean the radar pipeline
        await Stock.updateMany({}, { isActive: false });
        
        let count = 0;
        for (const symbol of topStocks) {
            await Stock.findOneAndUpdate(
                { symbol: symbol },
                { 
                    $set: { 
                        symbol: symbol,
                        name: symbol,
                        isFno: true,
                        isActive: true, // Only these will be processed Daily!
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );
            count++;
        }
        
        // Print and verify
        const activeStocks = await Stock.find({ isActive: true }).select('symbol');
        console.log(`\n🎯 Successfully Tracking exactly ${activeStocks.length} Large Cap F&O stocks.`);
        console.log('--- TRACKED UNIVERSE ---');
        console.log(activeStocks.map(s => s.symbol).join(', '));
        
        process.exit(0);
    } catch (e) {
        console.error("❌ Error setting up DB:", e.message);
        process.exit(1);
    }
}
seed();
