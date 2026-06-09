const mongoose = require('mongoose');
const SmartMoneyScore = require('../models/SmartMoneyScore');

async function checkDups() {
    await mongoose.connect('mongodb://localhost:27017/institutional-edge');
    
    const dups = await SmartMoneyScore.aggregate([
        { 
            $group: { 
                _id: { 
                    symbol: '$symbol', 
                    date: '$date', 
                    setupType: '$setupType' 
                }, 
                count: { $sum: 1 },
                ids: { $push: '$_id' }
            } 
        },
        { $match: { count: { $gt: 1 } } }
    ]);

    if (dups.length === 0) {
        console.log('No duplicates found in DB.');
    } else {
        console.log(`Found ${dups.length} sets of duplicates.`);
        for (const set of dups) {
            console.log(`- ${set._id.symbol} (${set._id.setupType}): ${set.count} copies`);
            // Keep the first one, delete the rest
            const toDelete = set.ids.slice(1);
            await SmartMoneyScore.deleteMany({ _id: { $in: toDelete } });
            console.log(`  Deleted ${toDelete.length} duplicates.`);
        }
    }
    
    process.exit(0);
}

checkDups().catch(err => {
    console.error(err);
    process.exit(1);
});
