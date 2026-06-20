const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Stock-Trading-code/backend/src/.env' });

const MONGO_URI = "mongodb://localhost:27017/institutional-edge";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const docs = await mongoose.connection.db.collection('dailyprices').find({ date: new Date("2026-06-20T12:00:00.000Z") }).limit(5).toArray();
        console.log(docs);
        
        // Also let's check unique dates
        const dates = await mongoose.connection.db.collection('dailyprices').distinct('date');
        console.log(dates.sort((a,b)=>b-a).slice(0,5));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
