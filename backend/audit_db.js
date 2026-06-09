const mongoose = require('mongoose');
const dns = require('dns');

// Force DNS fix for Windows SRV issues
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

async function audit() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const SectorIndex = require('./src/models/SectorIndex');
        const SmartMoneyScore = require('./src/models/SmartMoneyScore');
        const DivergenceAlert = require('./src/models/DivergenceAlert');
        const DailyPrice = require('./src/models/DailyPrice');
        const OiData = require('./src/models/OiData');

        const counts = {
            DailyPrices: await DailyPrice.countDocuments(),
            OiData: await OiData.countDocuments(),
            SectorIndices: await SectorIndex.countDocuments(),
            SmartMoneyScores: await SmartMoneyScore.countDocuments(),
            DivergenceAlerts: await DivergenceAlert.countDocuments()
        };

        console.log('\n--- Database Audit ---');
        console.table(counts);

        if (counts.SectorIndices === 0) {
            console.log('⚠️  Dashboard Card "Top Sector Leader" will be blank (0 SectorIndices).');
        }
        if (counts.SmartMoneyScores === 0) {
            console.log('⚠️  Dashboard Card "Active Opportunities" will be 0 (0 SmartMoneyScores).');
        }
        if (counts.DivergenceAlerts === 0) {
            console.log('⚠️  Dashboard Card "Critical Divergences" will be 0 (0 DivergenceAlerts).');
        }

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

audit();
