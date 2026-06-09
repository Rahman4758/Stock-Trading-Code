const mongoose = require('mongoose');
require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const DailySnapshot = require('./src/models/DailySnapshot');
const DailyPrice = require('./src/models/DailyPrice');
const FiiDiiData = require('./src/models/FiiDiiData');
const SectorIndex = require('./src/models/SectorIndex');

async function diagnose() {
    await connectMongo();
    
    console.log('--- Dashboard Diagnostic ---');
    
    const latestSnapshot = await DailySnapshot.findOne().sort({ date: -1 }).lean();
    console.log('Latest Snapshot:', latestSnapshot ? `${latestSnapshot.symbol} on ${latestSnapshot.date.toISOString()}` : 'NONE');

    const latestFiiDii = await FiiDiiData.findOne().sort({ date: -1 }).lean();
    console.log('Latest FII/DII Total:', latestFiiDii ? latestFiiDii.date.toISOString() : 'NONE');

    const latestPrice = await DailyPrice.findOne({ symbol: 'RELIANCE' }).sort({ date: -1 }).lean();
    console.log('Latest Price (RELIANCE):', latestPrice ? latestPrice.date.toISOString() : 'NONE');

    const latestIndex = await SectorIndex.findOne({ indexName: 'NIFTY50' }).sort({ date: -1 }).lean();
    console.log('Latest Index (NIFTY50):', latestIndex ? latestIndex.date.toISOString() : 'NONE');

    console.log('\n--- System Logic Check ---');
    const refDate = latestSnapshot ? latestSnapshot.date : new Date();
    const fromDate = new Date(refDate);
    fromDate.setUTCHours(0,0,0,0);
    
    const fiiCount = await FiiDiiData.countDocuments({ date: { $gte: fromDate } });
    console.log(`FII/DII Records from ${fromDate.toISOString()}: ${fiiCount}`);

    process.exit(0);
}

diagnose();
