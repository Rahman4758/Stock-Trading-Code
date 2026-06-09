/**
 * DB Health Check Part 2 — Check actual collection names and FII/OI data
 * Run from: c:\Stock-Trading-code\backend
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge';

async function run() {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📦 ALL COLLECTIONS IN DB:');
    for (const c of collections) {
        const count = await db.collection(c.name).countDocuments();
        console.log(`   ${c.name.padEnd(30)} → ${count} records`);
    }

    // Check FII/DII in correct collection name
    console.log('\n🏦 Checking FII data in each possible collection name:');
    const fiiNames = ['fiidiidata', 'fiidiidatas', 'fii_dii_data', 'marketfiidii', 'marketfii', 'fiidii'];
    for (const name of fiiNames) {
        try {
            const cnt = await db.collection(name).countDocuments();
            const latest = await db.collection(name).find().sort({ date: -1 }).limit(2).toArray();
            if (cnt > 0) {
                console.log(`   ✅ '${name}' has ${cnt} records. Latest: ${JSON.stringify(latest[0]).substring(0, 200)}`);
            }
        } catch (e) { /* skip */ }
    }

    // Check OI in correct collection name
    console.log('\n📉 Checking OI data in each possible collection name:');
    const oiNames = ['oisnapshots', 'oisnapshot', 'oidata', 'oi_data', 'oiDatas', 'futures'];
    for (const name of oiNames) {
        try {
            const cnt = await db.collection(name).countDocuments();
            const latest = await db.collection(name).find().sort({ date: -1 }).limit(1).toArray();
            if (cnt > 0) {
                console.log(`   ✅ '${name}' has ${cnt} records. Latest: ${JSON.stringify(latest[0]).substring(0, 200)}`);
            }
        } catch (e) { /* skip */ }
    }

    // SmartMoneyScore grade breakdown in detail (check if 'grade' field is actually saved)
    console.log('\n🎯 SmartMoneyScore deep check on latest date (Jun 05):');
    const jun05 = new Date('2026-06-05T12:00:00.000Z');
    const jun05Scores = await db.collection('smartmoneyscores').find({ date: jun05 }).limit(10).toArray();
    for (const s of jun05Scores) {
        console.log(`   ${s.symbol} | grade: ${s.grade} | compositeScore: ${s.compositeScore} | finalScore: ${s.finalScore} | setupType: ${s.setupType}`);
    }

    // Check what scores look like on Jun 04 (signalsFound: 3 per log)
    console.log('\n🎯 SmartMoneyScore - Jun 04 with grade A:');
    const jun04 = new Date('2026-06-04T12:00:00.000Z');
    const jun04Scores = await db.collection('smartmoneyscores').find({ date: jun04, grade: { $in: ['A+', 'A', 'B'] } }).toArray();
    for (const s of jun04Scores) {
        console.log(`   ${s.symbol} | grade: ${s.grade} | compositeScore: ${s.compositeScore} | finalScore: ${s.finalScore} | setupType: ${s.setupType}`);
    }

    // Sector check in all possible collection names
    console.log('\n🏭 Sector data collection check:');
    const sectorNames = ['sectorindices', 'sectorindex', 'sectorperformances', 'sectorstocks'];
    for (const name of sectorNames) {
        try {
            const cnt = await db.collection(name).countDocuments();
            if (cnt > 0) {
                const latest = await db.collection(name).find().sort({ lastUpdated: -1 }).limit(2).toArray();
                console.log(`   ✅ '${name}' has ${cnt} records. Sample: ${JSON.stringify(latest[0]).substring(0, 150)}`);
            } else {
                console.log(`   ⚠️  '${name}' is EMPTY`);
            }
        } catch (e) { /* skip */ }
    }

    // Bulk deals latest check
    console.log('\n📋 Bulk Deals latest dates:');
    const bulkDates = await db.collection('bulkdeals').aggregate([
        { $sort: { date: -1 } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 5 }
    ]).toArray();
    for (const b of bulkDates) {
        console.log(`   ${b._id} | ${b.count} deals`);
    }

    console.log('\n✅ Done.\n');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('\n❌ FAILED:', err.message);
    process.exit(1);
});
