const mongoose = require('mongoose');
require('dotenv').config({path: 'src/.env'});
const strategy = require('./src/strategies/dynamicMomentumStrategy');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('Testing dynamic momentum strategy...');
    const results = await strategy.scan({ minScore: 0 });
    console.log('Results length:', results.length);
    if (results.length > 0) {
        console.log('Top result checklist:', results[0].checklist);
    }
    process.exit(0);
}).catch(console.error);
