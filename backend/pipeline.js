require('dotenv').config();
const { connectMongo, redisClient } = require('./src/config/db');
const { runPipeline } = require('./src/scheduler/cron');

const main = async () => {
    console.log('=== InstitutionalEdge MERN — Manual Pipeline Trigger ===\n');
    await connectMongo();
    try { await redisClient.connect(); } catch { /* Redis optional */ }

    await runPipeline();

    console.log('\nDisconnecting...');
    process.exit(0);
};

main().catch((err) => {
    console.error('Pipeline failed:', err);
    process.exit(1);
});
