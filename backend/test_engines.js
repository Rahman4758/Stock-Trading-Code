require('dotenv').config({ path: '.env' });
const { connectMongo } = require('./src/config/db');

async function testEngines() {
    await connectMongo();
    
    console.log('[1/2] Running Analysis Engine...');
    try {
        const stockSelector = require('./src/core/stockSelector');
        const scanResults = await stockSelector.scanUniverse();
        console.log(`[1/2] Done: ${scanResults.length} stocks scored\n`);
    } catch (e) { 
        console.error('[1/2] Analysis Failed:', e.message, '\n'); 
    }

    console.log('[2/2] Running Exit Monitor...');
    try {
        const exitMonitor = require('./src/services/exitMonitor');
        await exitMonitor.evaluateExits();
        console.log(`[2/2] Exit Monitoring checks completed\n`);
    } catch (e) {
        console.error('[2/2] Exit Monitoring Failed:', e.message, '\n');
    }

    process.exit(0);
}

testEngines();
