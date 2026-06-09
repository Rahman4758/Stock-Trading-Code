const { redisClient } = require('./src/config/db');
require('dotenv').config({path: 'src/.env'});

(async () => {
    try {
        await redisClient.connect();
        await redisClient.flushAll();
        console.log('Redis cache cleared!');
        process.exit(0);
    } catch (e) {
        console.log('No redis running or failed to clear:', e.message);
        process.exit(0);
    }
})();
