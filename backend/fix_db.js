const mongoose = require('mongoose');
const dns = require('dns');
const SectorCollector = require('./src/collectors/sectorCollector');
const SectorIndex = require('./src/models/SectorIndex');
const SmartMoneyScore = require('./src/models/SmartMoneyScore');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

async function fixAndAudit() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected');

        const collector = new SectorCollector();
        
        // 1. Recompute Sector RS for all dates
        const dates = await SectorIndex.distinct('date');
        const sortedDates = dates.sort((a, b) => a - b);
        console.log(`📊 Recomputing RS for ${sortedDates.length} days of sector data...`);

        for (const date of sortedDates) {
            const indices = await SectorIndex.find({ date });
            for (const idx of indices) {
                const rsData = await collector.computeSectorRs(idx.indexName, idx.close);
                await SectorIndex.findByIdAndUpdate(idx._id, { $set: rsData });
            }
        }
        console.log('✅ Sector RS Recomputed.');

        // 2. Audit SmartMoneyScore distribution
        const scores = await SmartMoneyScore.find().sort({ date: -1 }).limit(100).lean();
        const avg = scores.reduce((a, b) => a + b.compositeScore, 0) / (scores.length || 1);
        const max = Math.max(...scores.map(s => s.compositeScore), 0);
        
        console.log(`\n--- Score Audit ---`);
        console.log(`Total Scores: ${scores.length}`);
        console.log(`Average Score: ${avg.toFixed(2)}`);
        console.log(`Max Score: ${max.toFixed(2)}`);
        
        const top5 = scores.sort((a,b) => b.compositeScore - a.compositeScore).slice(0, 5);
        console.log('Top 5 Scores:');
        top5.forEach(s => console.log(` - ${s.symbol}: ${s.compositeScore}`));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

fixAndAudit();
