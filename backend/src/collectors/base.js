const axios = require('axios');

// Simple in-memory rate limiter
class RateLimiter {
    constructor(calls = 5, periodMs = 60000) {
        this.calls = calls;
        this.periodMs = periodMs;
        this.timestamps = [];
    }

    async wait() {
        const now = Date.now();
        this.timestamps = this.timestamps.filter((t) => now - t < this.periodMs);
        if (this.timestamps.length >= this.calls) {
            const oldest = this.timestamps[0];
            const delay = this.periodMs - (now - oldest) + 50;
            await new Promise((r) => setTimeout(r, delay));
        }
        this.timestamps.push(Date.now());
    }
}

class BaseCollector {
    constructor({ sourceName, baseUrl, rateLimitCalls = 5, rateLimitPeriod = 60000 }) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.limiter = new RateLimiter(rateLimitCalls, rateLimitPeriod);

        // Axios session with NSE headers
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 10000,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
    }

    async initCookies() {
        try {
            const resp = await this.client.get('/');
            const cookies = resp.headers['set-cookie'];
            if (cookies) {
                this.client.defaults.headers.Cookie = cookies.map((c) => c.split(';')[0]).join('; ');
            }
        } catch (err) {
            console.warn(`[${this.sourceName}] Failed to init session (403 typical for NSE bots). Will use mocks if APIs fail.`);
        }
    }

    async request(method, url, params = {}) {
        await this.limiter.wait();
        const response = await this.client.request({ method, url, params });
        return response.data;
    }

}

module.exports = BaseCollector;
