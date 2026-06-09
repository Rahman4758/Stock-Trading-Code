const mongoose = require('mongoose');
require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const DailyPrice = require('./src/models/DailyPrice');

async function debug() {
    await connectMongo();
    const latest = await DailyPrice.findOne().sort({ date: -1 }).lean();
    console.log('Latest Price Record:', JSON.stringify(latest, null, 2));
    
    const count = await DailyPrice.countDocuments();
    console.log('Total Price Records:', count);
    
    process.exit(0);
}

debug();
