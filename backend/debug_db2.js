const mongoose = require('mongoose');
const FiiDiiData = require('./src/models/FiiDiiData');
require('dotenv').config({ path: './src/.env' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge');
    const symbols = await FiiDiiData.distinct('symbol');
    console.log('Distinct FII/DII symbols:', symbols);
    
    process.exit(0);
}
run();
