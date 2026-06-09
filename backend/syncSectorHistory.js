const mongoose = require('mongoose');
const dns = require('dns');
const SectorCollector = require('./src/collectors/sectorCollector');

// Force DNS fix for Windows SRV issues
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

async function syncSectorHistory() {
    console.log('🚀 Starting Sector Historical Data Sync...');
    
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const collector = new SectorCollector();
        await collector.syncHistory(30);

        console.log('\n🎉 Sector History Sync Complete!');
    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

syncSectorHistory();
