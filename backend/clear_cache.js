require('dotenv').config({ path: './src/.env' });
const { redisClient } = require('./src/config/db');

redisClient.flushall().then(() => {
    console.log('Redis cache successfully cleared!');
    process.exit(0);
}).catch(e => {
    console.log(e);
});
