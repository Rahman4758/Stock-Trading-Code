const mongoose = require('mongoose');
const FiiDiiData = require('./src/models/FiiDiiData');
require('dotenv').config({ path: './src/.env' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge');
    const data = await FiiDiiData.find({ symbol: 'POWERGRID' }).sort({ date: -1 }).limit(5).lean();
    console.log('POWERGRID FII/DII records:', data);
    process.exit(0);
}
run();
