const mongoose = require('mongoose');
const SmartMoneyScore = require('./src/models/SmartMoneyScore');
require('dotenv').config({ path: './src/.env' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/institutional-edge');
    const latestScore = await SmartMoneyScore.findOne().sort({ date: -1 }).select('date').lean();
    console.log('Latest Score Date:', latestScore ? latestScore.date : 'NONE');
    
    if (latestScore) {
        const scores = await SmartMoneyScore.find({ date: latestScore.date })
            .sort({ finalScore: -1, compositeScore: -1 })
            .limit(50)
            .lean();
        console.log(`Scores found for ${latestScore.date}: ${scores.length}`);
    }
    process.exit(0);
}
run();
