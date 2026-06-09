const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const SectorStock = require('./src/models/SectorStock');
const DailyPrice = require('./src/models/DailyPrice');
const SmartMoneyScore = require('./src/models/SmartMoneyScore');

async function test() {
    await connectMongo();
    const id = 'METAL';
    const tf = '1M';

    const sectorStocks = await SectorStock.find({ sector_id: id }).lean();
    const symbols = sectorStocks.map(s => s.symbol);

    const latestScores = await SmartMoneyScore.aggregate([
        { $match: { symbol: { $in: symbols } } },
        { $sort: { date: -1 } },
        { $group: { _id: "$symbol", doc: { $first: "$$ROOT" } } }
    ]);

    const scoreMap = {};
    latestScores.forEach(s => scoreMap[s._id] = s.doc);

    const timeframeDays = { '1W': 5, '1M': 22, '3M': 66, '6M': 132 };
    const days = timeframeDays[tf] || 22;

    const stocks = await Promise.all(sectorStocks.map(async (s) => {
        const score = scoreMap[s.symbol] || {};
        const history = await DailyPrice.find({ symbol: s.symbol })
            .sort({ date: -1 })
            .limit(days)
            .select('close date')
            .lean();

        console.log(`Symbol: ${s.symbol}, History Length: ${history.length}`);
        
        let price = 0;
        let change = 0;

        if (history.length > 0) {
            price = history[0].close;
            const oldPrice = history[history.length - 1].close;
            change = ((price - oldPrice) / oldPrice) * 100;
        }

        return { symbol: s.symbol, price, change };
    }));

    process.exit(0);
}

test();
