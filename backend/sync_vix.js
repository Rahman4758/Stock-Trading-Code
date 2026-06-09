const mongoose = require('mongoose');
const SectorCollector = require('./src/collectors/SectorCollector');
const { connectMongo } = require('./src/config/db');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function run() {
    await connectMongo();
    const collector = new SectorCollector();
    
    // Manually fetch all indices to debug VIX
    await collector.initCookies();
    const data = await collector.request('GET', '/api/allIndices');
    const allIndices = data.data || [];
    
    const vix = allIndices.find(i => i.index.includes('VIX'));
    if (vix) {
        console.log('Found VIX in sync:', vix.last);
        const targetDate = new Date();
        targetDate.setHours(0,0,0,0);
        
        await require('./src/models/SectorIndex').findOneAndUpdate(
            { indexName: 'INDIA_VIX', date: targetDate },
            { $set: { indexName: 'INDIA_VIX', date: targetDate, close: parseFloat(vix.last), rsVsNifty: 100, rsTrend: 'NEUTRAL' } },
            { upsert: true }
        );
        console.log('VIX Saved to DB');
    } else {
        console.log('VIX still not found in response');
    }
    
    await collector.collect();
    process.exit();
}

run();
