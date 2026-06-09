require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const Stock = require('./src/models/Stock');
const SectorStock = require('./src/models/SectorStock');

async function run() {
    await connectMongo();
    const allActive = await Stock.find({ isActive: true }).lean();
    const mapped = await SectorStock.find({}).lean();
    
    const mappedSymbols = new Set(mapped.map(m => m.symbol));
    const unmapped = allActive.filter(s => !mappedSymbols.has(s.symbol)).map(s => s.symbol);
    
    console.log(`Unmapped stocks (${unmapped.length}):`, unmapped.join(', '));
    process.exit(0);
}

run();
