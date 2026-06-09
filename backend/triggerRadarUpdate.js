const mongoose = require('mongoose');
const SectorRotationSystem = require('./src/systems/SectorRotationSystem');

async function trigger() {
    await mongoose.connect('mongodb://localhost:27017/institutional-edge');
    console.log('Connected to MongoDB');

    await SectorRotationSystem.updateAllTimeframes();
    console.log('Update complete.');
    process.exit(0);
}

trigger().catch(console.error);
