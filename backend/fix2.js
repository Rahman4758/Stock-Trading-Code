const mongoose = require('mongoose');
require('dotenv').config({path: 'src/.env'});
const convictionService = require('./src/services/ConvictionService');
const Stock = require('./src/models/Stock');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('Recomputing Conviction Scores...');
    const stocks = await Stock.find({ isActive: true }).lean();
    for (const stock of stocks) {
        await convictionService.compute(stock.symbol, 20, null, null, true);
        process.stdout.write('.');
    }
    console.log('\nDone!');
    process.exit(0);
}).catch(console.error);
