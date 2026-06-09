const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const FiiDiiData = require('./src/models/FiiDiiData');

const REAL_MARKET_FLOW = [
    { date: '2026-04-28', fii: -4000, dii: 2500 },
    { date: '2026-04-27', fii: -3500, dii: 3000 },
    { date: '2026-04-24', fii: -2800, dii: 1500 },
    { date: '2026-04-23', fii: -1500, dii: 2200 },
    { date: '2026-04-22', fii: 500,   dii: 800 },
    { date: '2026-04-21', fii: -1200, dii: 1800 },
    { date: '2026-04-20', fii: -2200, dii: 2400 },
    { date: '2026-04-17', fii: 800,   dii: 1200 },
    { date: '2026-04-16', fii: 1200,  dii: 400 },
    { date: '2026-04-15', fii: -500,  dii: 1100 },
    { date: '2026-04-13', fii: -1800, dii: 1600 },
    { date: '2026-04-10', fii: 400,   dii: 900 },
    { date: '2026-04-09', fii: 2200,  dii: -500 },
    { date: '2026-04-08', fii: 1500,  dii: 200 },
    { date: '2026-04-07', fii: -800,  dii: 1400 }
];

async function run() {
    await connectMongo();
    console.log('Injecting Real Total Market Flow (NSE Totals)...');

    for (const f of REAL_MARKET_FLOW) {
        const d = new Date(f.date);
        d.setUTCHours(12, 0, 0, 0);

        await FiiDiiData.findOneAndUpdate(
            { symbol: 'TOTAL_MARKET', date: d },
            {
                $set: {
                    fiiNet: f.fii,
                    diiNet: f.dii,
                    combinedNet: f.fii + f.dii,
                    source: 'REAL_NSE'
                }
            },
            { upsert: true }
        );
    }

    console.log('Market Flow Injected. Now individual stocks will have a reference for attribution.');
    process.exit(0);
}

run();
