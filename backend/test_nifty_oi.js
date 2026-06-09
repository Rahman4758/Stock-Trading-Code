require('dotenv').config({ path: 'src/.env' });
const mongoose = require('mongoose');
const { connectMongo } = require('./src/config/db');
const OiCollector = require('./src/collectors/oiCollector');

async function testOi() {
    await connectMongo();
    const collector = new OiCollector();
    const result = await collector.collect({ symbols: ['NIFTY'] });
    console.log('Result:', result);
    process.exit(0);
}
testOi();
