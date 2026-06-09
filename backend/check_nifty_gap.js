const mongoose = require('mongoose');
const SectorIndex = require('./src/models/SectorIndex');
const { connectMongo } = require('./src/config/db');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function check() {
    await connectMongo();
    const start = new Date('2026-03-25');
    const end = new Date('2026-04-12');
    const data = await SectorIndex.find({ indexName: 'NIFTY50', date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean();
    console.log('Nifty Data Check:');
    data.forEach(d => {
        console.log(`${d.date.toISOString().split('T')[0]}: ${d.close}`);
    });
    process.exit();
}

check();
