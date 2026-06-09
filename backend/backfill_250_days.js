require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const Stock = require('./src/models/Stock');
const DailyPrice = require('./src/models/DailyPrice');
const YF = require('yahoo-finance2').default;
const yf = new YF({ suppressNotices: ['ripHistorical'] });

async function run() {
    await connectMongo();
    const stocks = await Stock.find({ isActive: true }).lean();
    console.log(`Starting historical backfill for ${stocks.length} active stocks...`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 350); // Get ~350 calendar days
    const period1 = startDate.toISOString().split('T')[0];

    for (let s = 0; s < stocks.length; s++) {
        const symbol = stocks[s].symbol;
        const yahooSymbol = `${symbol}.NS`;
        
        try {
            const chartData = await yf.chart(yahooSymbol, { period1, interval: '1d' });
            const results = chartData.quotes;
            if (!results || results.length === 0) continue;

            const bulkOps = [];
            for (const row of results) {
                if (!row.close) continue;
                const dateStr = new Date(row.date).toISOString().split('T')[0];
                const dateObj = new Date(dateStr);
                dateObj.setUTCHours(12, 0, 0, 0);

                bulkOps.push({
                    updateOne: {
                        filter: { symbol, date: dateObj },
                        update: {
                            $setOnInsert: {
                                symbol,
                                date: dateObj,
                            },
                            $set: {
                                open: row.open,
                                high: row.high,
                                low: row.low,
                                close: row.close,
                                volume: row.volume || 0
                            }
                        },
                        upsert: true
                    }
                });
            }

            if (bulkOps.length > 0) {
                await DailyPrice.bulkWrite(bulkOps, { ordered: false });
            }
            process.stdout.write(`\rProcessed ${s + 1}/${stocks.length} - ${symbol} (${bulkOps.length} days)      `);
        } catch (e) {
            console.error(`\nFailed for ${symbol}: ${e.message}`);
        }
    }
    console.log('\nFetching complete! Now run computeTechnicals.js');
    process.exit(0);
}

run();
