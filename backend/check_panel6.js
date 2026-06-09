require('dotenv').config({ path: 'src/.env' });
const mongoose = require('mongoose');
const { connectMongo } = require('./src/config/db');
const OiData = require('./src/models/OiData');

async function check() {
    await connectMongo();
    const d = await OiData.findOne({symbol: { $in: ['NIFTY', 'NIFTY50', 'NIFTY 50', '^NSEI'] }}).sort({date: -1}).lean();
    console.log('Latest Nifty OI Data:', d);
    process.exit(0);
}
check();
