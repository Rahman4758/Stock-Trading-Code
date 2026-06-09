require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const FiiDiiData = require('./src/models/FiiDiiData');

async function test() {
    await connectMongo();
    
    const count14 = await FiiDiiData.countDocuments({ date: { $gte: new Date('2026-05-14T00:00:00.000Z'), $lt: new Date('2026-05-15T00:00:00.000Z') } });
    const count15 = await FiiDiiData.countDocuments({ date: { $gte: new Date('2026-05-15T00:00:00.000Z') } });
    
    console.log(`2026-05-14 Docs: ${count14}`);
    console.log(`2026-05-15 Docs: ${count15}`);

    // If there's only 1 doc, let's see what it is
    if (count15 > 0) {
        const doc = await FiiDiiData.findOne({ date: { $gte: new Date('2026-05-15T00:00:00.000Z') } }).lean();
        console.log('Sample for 15:', doc);
    }
    
    process.exit(0);
}

test();
