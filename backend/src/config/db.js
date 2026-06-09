const mongoose = require('mongoose');
const dns = require('dns');

// Force Google DNS to fix Windows SRV lookup issue with mongodb+srv://
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
};

// Temporarily disabled Redis to prevent connection warnings locally
// const redisClient = new (require('ioredis'))({
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT) || 6379,
//     lazyConnect: true,
// });
// redisClient.on('connect', () => console.log('✅ Redis connected'));
// redisClient.on('error', (err) => console.warn('⚠️  Redis error:', err.message));

// Mock Redis Client to seamlessly return "Cache Misses" without crashing routes
const redisClient = {
    get: async () => null,
    set: async () => null,
    setex: async () => null,
    del: async () => null,
    on: () => {},
};

module.exports = { connectMongo, redisClient };
