const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const DailySnapshot = require('./src/models/DailySnapshot');
const Stock = require('./src/models/Stock');

connectMongo().then(async () => {
    try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 20); // 20D window

        const flow = await DailySnapshot.aggregate([
            { $match: { date: { $gte: fromDate } } },
            {
                $lookup: {
                    from: 'stocks',
                    localField: 'symbol',
                    foreignField: 'symbol',
                    as: 'stockInfo'
                }
            },
            { $unwind: '$stockInfo' },
            {
                $group: {
                    _id: '$stockInfo.sector',
                    fii_net: { $sum: '$fii_net_cr' },
                    dii_net: { $sum: '$dii_net_cr' }
                }
            },
            { $sort: { fii_net: -1 } }
        ]);

        console.log('Current DB Aggregation (Last 20 Days):');
        console.table(flow);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
});
