const mongoose = require('mongoose');
require('dotenv').config({path: 'src/.env'});

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const SmartMoneyScore = require('./src/models/SmartMoneyScore');
    const res = await SmartMoneyScore.deleteMany({ date: '2026-06-08' });
    console.log('Deleted records from today:', res.deletedCount);
    process.exit(0);
}).catch(console.error);
