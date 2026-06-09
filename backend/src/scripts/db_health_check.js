/**
 * DB Health Check — InstitutionalEdge
 * Run from: c:\Stock-Trading-code\backend
 * Usage: node src/scripts/db_health_check.js
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge';

async function run() {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        InstitutionalEdge — DB Health Report                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // ── 1. STOCKS ──────────────────────────────────────────────────────────
    const totalStocks = await db.collection('stocks').countDocuments({ isActive: true });
    const allStocks = await db.collection('stocks').find({ isActive: true }, { projection: { symbol: 1 } }).toArray();
    console.log(`📦 STOCKS  Total Active: ${totalStocks}`);
    console.log(`   Symbols: ${allStocks.map(s => s.symbol).sort().join(', ')}\n`);

    // ── 2. DAILY PRICE — date range & count per date ───────────────────────
    const priceDateAgg = await db.collection('dailyprices').aggregate([
        { $sort: { date: -1 } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                count: { $sum: 1 },
                withDelivery: { $sum: { $cond: [{ $gt: ['$deliveryPct', 0] }, 1, 0] } }
            }
        },
        { $sort: { _id: -1 } },
        { $limit: 30 }
    ]).toArray();

    console.log('📈 DAILY PRICE — Last 30 dates (newest first):');
    console.log('   Date         | Stocks | Delivery | Status');
    console.log('   -------------|--------|----------|----------------------');
    for (const d of priceDateAgg) {
        const isComplete = d.count >= 20 && d.withDelivery >= 20;
        let flag;
        if (isComplete) flag = '✅ Complete';
        else if (d.count >= 20 && d.withDelivery < 20) flag = '⚠️  MISSING DELIVERY';
        else flag = `❌ LOW PRICE COUNT (${d.count})`;
        console.log(`   ${d._id}  |  ${String(d.count).padEnd(5)} |   ${String(d.withDelivery).padEnd(5)}|  ${flag}`);
    }

    const latestPriceDate = priceDateAgg[0]?._id;

    // ── 3. SYMBOL COVERAGE on latest date ─────────────────────────────────
    if (latestPriceDate) {
        const latestDateObj = new Date(latestPriceDate + 'T12:00:00.000Z');
        const symbolsOnLatest = await db.collection('dailyprices').find(
            { date: latestDateObj },
            { projection: { symbol: 1, deliveryPct: 1, volume: 1, close: 1, high: 1, low: 1 } }
        ).toArray();

        const activeSymbols = new Set(allStocks.map(s => s.symbol));
        const presentSymbols = new Set(symbolsOnLatest.map(s => s.symbol));
        const missingSymbols = [...activeSymbols].filter(s => !presentSymbols.has(s));
        const noDelivery = symbolsOnLatest.filter(s => !s.deliveryPct || s.deliveryPct === 0).map(s => s.symbol);

        console.log(`\n📊 SYMBOL COVERAGE on ${latestPriceDate}:`);
        console.log(`   Active stocks: ${totalStocks} | Present: ${symbolsOnLatest.length} | Missing: ${missingSymbols.length}`);
        if (missingSymbols.length > 0) console.log(`   ❌ Missing symbols: ${missingSymbols.join(', ')}`);
        else console.log(`   ✅ All active stocks have price records`);
        if (noDelivery.length > 0) console.log(`   ⚠️  Zero delivery%: ${noDelivery.join(', ')}`);
        else console.log(`   ✅ All symbols have delivery% data`);

        console.log(`\n   Sample (${latestPriceDate}):`);
        console.log(`   Symbol          | Close    | Volume       | Delivery%`);
        console.log(`   ----------------|----------|--------------|----------`);
        for (const s of symbolsOnLatest.slice(0, 15)) {
            const vol = s.volume ? s.volume.toLocaleString() : 'N/A';
            console.log(`   ${String(s.symbol).padEnd(16)}| ₹${String((s.close ?? 0).toFixed(2)).padEnd(8)}| ${String(vol).padEnd(13)}| ${(s.deliveryPct ?? 0).toFixed(2)}%`);
        }
    }

    // ── 4. FII/DII MARKET DATA ─────────────────────────────────────────────
    const fiiCount = await db.collection('fiidiidata').countDocuments();
    const latestFii = await db.collection('fiidiidata').find().sort({ date: -1 }).limit(7).toArray();
    console.log(`\n🏦 FII/DII MARKET DATA:  Total records: ${fiiCount}`);
    if (latestFii.length > 0) {
        console.log(`   Date         | FII Buy    | FII Sell   | FII Net    | DII Buy    | DII Net`);
        console.log(`   -------------|------------|------------|------------|------------|--------`);
        for (const f of latestFii) {
            const dateStr = f.date?.toISOString?.()?.split('T')[0] || String(f.date).substring(0, 10);
            const fiiBuy  = ((f.fiiGrossBuy  ?? 0) / 1e7).toFixed(1);
            const fiiSell = ((f.fiiGrossSell ?? 0) / 1e7).toFixed(1);
            const fiiNet  = ((f.fiiNet       ?? 0) / 1e7).toFixed(1);
            const diiBuy  = ((f.diiGrossBuy  ?? 0) / 1e7).toFixed(1);
            const diiNet  = ((f.diiNet       ?? 0) / 1e7).toFixed(1);
            console.log(`   ${dateStr}  | ₹${String(fiiBuy).padEnd(9)}| ₹${String(fiiSell).padEnd(9)}| ₹${String(fiiNet).padEnd(9)}| ₹${String(diiBuy).padEnd(9)}| ₹${diiNet}Cr`);
        }
    } else {
        console.log('   ❌ NO FII/DII DATA FOUND IN DB');
    }

    // ── 5. OI DATA ─────────────────────────────────────────────────────────
    const oiCount = await db.collection('oisnapshots').countDocuments();
    const latestOiDates = await db.collection('oisnapshots').aggregate([
        { $sort: { date: -1 } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 7 }
    ]).toArray();
    console.log(`\n📉 OI SNAPSHOT DATA:  Total records: ${oiCount}`);
    if (latestOiDates.length > 0) {
        for (const o of latestOiDates) {
            const complete = o.count >= 10;
            console.log(`   ${o._id} | ${o.count} symbols ${complete ? '✅' : '⚠️'}`);
        }
    } else {
        console.log('   ❌ NO OI DATA FOUND');
    }

    // ── 6. SMARTMONEY SCORES ───────────────────────────────────────────────
    const scoreCount = await db.collection('smartmoneyscores').countDocuments();
    const scoresByDate = await db.collection('smartmoneyscores').aggregate([
        { $sort: { date: -1 } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                count: { $sum: 1 },
                grades: { $push: '$grade' },
                topSymbols: { $push: '$symbol' }
            }
        },
        { $sort: { _id: -1 } },
        { $limit: 12 }
    ]).toArray();

    console.log(`\n🎯 SMARTMONEY SCORES (Signals):  Total: ${scoreCount}`);
    console.log(`   Date         | Signals | Grade Breakdown`);
    console.log(`   -------------|---------|----------------`);
    for (const s of scoresByDate) {
        const ap = s.grades.filter(g => g === 'A+').length;
        const a  = s.grades.filter(g => g === 'A').length;
        const b  = s.grades.filter(g => g === 'B').length;
        const c  = s.grades.filter(g => g === 'C').length;
        console.log(`   ${s._id}  |   ${String(s.count).padEnd(4)} | A+:${ap} A:${a} B:${b} C:${c}`);
    }

    // ── 7. MAY 28 SPECIFIC CHECK ───────────────────────────────────────────
    console.log('\n🔎 SPECIFIC DATE CHECKS (known issues):');
    const checkDates = [
        { label: 'May 28 2026 (SKIPPED in sync)', date: new Date('2026-05-28T12:00:00.000Z') },
        { label: 'Jun 05 2026 (0 signals)', date: new Date('2026-06-05T12:00:00.000Z') },
        { label: 'Jun 06 2026 (latestDataDate)', date: new Date('2026-06-06T12:00:00.000Z') },
    ];
    for (const { label, date } of checkDates) {
        const pc = await db.collection('dailyprices').countDocuments({ date });
        const dc = await db.collection('dailyprices').countDocuments({ date, deliveryPct: { $gt: 0 } });
        const sc = await db.collection('smartmoneyscores').countDocuments({ date });
        const fc = await db.collection('fiidiidata').countDocuments({ date });
        const oc = await db.collection('oisnapshots').countDocuments({ date });
        const status = pc >= 20 && dc >= 20 ? '✅' : (pc === 0 ? '❌ NO DATA' : '⚠️  PARTIAL');
        console.log(`   ${label}:`);
        console.log(`     Price: ${pc} | Delivery: ${dc} | Scores: ${sc} | FII: ${fc} | OI: ${oc} ${status}`);
    }

    // ── 8. BULK DEALS ──────────────────────────────────────────────────────
    const bulkCount = await db.collection('bulkdeals').countDocuments();
    const latestBulk = await db.collection('bulkdeals').find().sort({ date: -1 }).limit(5).toArray();
    console.log(`\n📋 BULK DEALS: Total records: ${bulkCount}`);
    for (const b of latestBulk) {
        const dateStr = b.date?.toISOString?.()?.split('T')[0] || String(b.date).substring(0, 10);
        console.log(`   ${dateStr} | ${b.symbol} | ${b.dealType} | ₹${(b.dealValue ?? 0).toFixed(0)}`);
    }

    // ── 9. SECTOR DATA ─────────────────────────────────────────────────────
    const sectorCount = await db.collection('sectorindices').countDocuments();
    const latestSector = await db.collection('sectorindices').find().sort({ lastUpdated: -1 }).limit(3).toArray();
    console.log(`\n🏭 SECTOR DATA: Total: ${sectorCount}`);
    for (const s of latestSector) {
        const d = s.lastUpdated?.toISOString?.()?.split('T')[0] || 'N/A';
        console.log(`   ${s.indexName} | RS: ${s.rsCurrent} | Signal: ${s.rotationSignal} | Updated: ${d}`);
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  Health Check Complete ✅                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('\n❌ DB Health Check FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
});
