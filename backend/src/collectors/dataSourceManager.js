/**
 * Data Source Manager
 * Unified interface to switch between data sources:
 * - NSE Puppeteer (default for testing)
 * - Upstox API (production backup)
 * 
 * Set DATA_SOURCE in .env: 'nse' or 'upstox'
 */
const NsePuppeteerCollector = require('./nsePuppeteer');
const UpstoxCollector = require('./upstoxCollector');
const MacroCollector = require('./MacroCollector');
const OiCollector = require('./oiCollector');

class DataSourceManager {
    constructor(source = null) {
        // Production-safe configuration
        const env = process.env.NODE_ENV || 'development';
        
        // Environment-specific data source configuration
        const config = {
            production: {
                allowedSources: ['upstox', 'nse_api'], // No synthetic data
                defaultSource: 'upstox',
                qualityThreshold: 0.95
            },
            staging: {
                allowedSources: ['upstox', 'nse_puppeteer', 'synthetic'],
                defaultSource: 'nse_puppeteer',
                qualityThreshold: 0.80
            },
            development: {
                allowedSources: ['upstox', 'nse_puppeteer', 'synthetic', 'mock'],
                defaultSource: 'synthetic',
                qualityThreshold: 0.60
            }
        };

        const envConfig = config[env] || config.development;
        
        // Validate source selection
        this.source = source || process.env.DATA_SOURCE || envConfig.defaultSource;
        
        if (!envConfig.allowedSources.includes(this.source)) {
            console.warn(`[DataSource] ${this.source} not allowed in ${env} environment`);
            this.source = envConfig.defaultSource;
        }

        this.collector = null;
        this.initialized = false;
        this.qualityThreshold = envConfig.qualityThreshold;
        this.environment = env;
        
        console.log(`[DataSource] Environment: ${env.toUpperCase()}`);
        console.log(`[DataSource] Using: ${this.source.toUpperCase()}`);
        console.log(`[DataSource] Quality Threshold: ${(this.qualityThreshold * 100).toFixed(0)}%`);
    }

    /**
     * Initialize the appropriate collector
     */
    async init() {
        if (this.initialized) return;

        if (this.source === 'upstox') {
            this.collector = new UpstoxCollector();
            if (!this.collector.isConfigured()) {
                console.warn('[DataSource] Upstox not configured, falling back to NSE Puppeteer');
                this.source = 'nse';
                this.collector = new NsePuppeteerCollector();
                await this.collector.init();
            }
        } else {
            this.collector = new NsePuppeteerCollector();
            await this.collector.init();
        }

        this.initialized = true;
    }

    /**
     * Get current data source name
     */
    getSourceName() {
        return this.source === 'upstox' ? 'Upstox API' : 'NSE Puppeteer';
    }

    /**
     * Collect price data (OHLCV + Delivery)
     */
    async collectPrices(options = {}) {
        await this.init();
        console.log(`[${this.getSourceName()}] Collecting prices...`);
        return await this.collector.collectPrices(options);
    }

    /**
     * Collect Open Interest data
     * When source is Upstox: uses UpstoxCollector.collectOiData() which fetches
     *   real futures OI via NSE_FO instrument keys (FuturesKeyBuilder).
     * When source is NSE: uses the NSE Puppeteer OiCollector (requires session cookies).
     */
    async collectOiData(options = {}) {
        await this.init();

        if (this.source === 'upstox') {
            console.log('[OiCollector] Routing to Upstox futures OI collector...');
            return await this.collector.collectOiData(options);
        }

        console.log('[OiCollector] F&O Open Interest data falling back to NSE Puppeteer...');
        
        const nseCollector = new NsePuppeteerCollector();
        await nseCollector.init();
        const result = await nseCollector.collectOiData(options);
        // Clean up puppeteer browser
        if (nseCollector.browser) await nseCollector.browser.close();
        return result;
    }

    /**
     * Collect FII/DII data (NSE only - Upstox doesn't provide this)
     */
    async collectFiiDii(options = {}) {
        await this.init();
        
        if (this.source === 'upstox') {
            console.log('[Upstox] FII/DII data not available via Upstox API');
            console.log('[Upstox] Falling back to NSE Puppeteer for FII/DII...');
            
            const nseCollector = new NsePuppeteerCollector();
            await nseCollector.init();
            const result = await nseCollector.collectFiiDii(options);
            await nseCollector.close();
            return result;
        }
        
        console.log(`[${this.getSourceName()}] Collecting FII/DII data...`);
        return await this.collector.collectFiiDii(options);
    }

    /**
     * Collect Bulk Deals (NSE only)
     */
    async collectBulkDeals(options = {}) {
        await this.init();
        
        if (this.source === 'upstox') {
            console.log('[Upstox] Bulk deals not available via Upstox API');
            console.log('[Upstox] Falling back to NSE Puppeteer for Bulk Deals...');
            
            const nseCollector = new NsePuppeteerCollector();
            await nseCollector.init();
            const result = await nseCollector.collectBulkDeals(options);
            await nseCollector.close();
            return result;
        }
        
        console.log(`[${this.getSourceName()}] Collecting Bulk Deals...`);
        return await this.collector.collectBulkDeals(options);
    }

    /**
     * Collect Global Macro Data (Gold, Oil, FX)
     */
    async collectGlobalMarkets() {
        const macroCollector = new MacroCollector();
        return await macroCollector.collect();
    }

    /**
     * Close connections
     */
    async close() {
        if (this.collector && typeof this.collector.close === 'function') {
            await this.collector.close();
        }
        this.initialized = false;
    }

    /**
     * Switch data source at runtime
     */
    async switchSource(newSource) {
        console.log(`[DataSource] Switching from ${this.source} to ${newSource}`);
        await this.close();
        this.source = newSource;
        this.initialized = false;
        await this.init();
    }

    /**
     * Fetch only LTP for multiple symbols
     */
    async fetchLtpOnly(symbols) {
        await this.init();
        if (typeof this.collector.fetchLtpOnly === 'function') {
            return await this.collector.fetchLtpOnly(symbols);
        }
        
        // Fallback: fetch one by one
        const results = {};
        for (const symbol of symbols) {
            const quote = await this.collector.fetchQuote(symbol);
            if (quote) results[symbol] = quote.close;
        }
        return results;
    }

    /**
     * Get status of all available data sources
     */
    static getAvailableSources() {
        const upstox = new UpstoxCollector();
        return {
            nse: {
                name: 'NSE Puppeteer',
                available: true,
                description: 'Real browser scraping - works but slower',
            },
            upstox: {
                name: 'Upstox API',
                available: upstox.isConfigured(),
                description: upstox.isConfigured() 
                    ? 'Official API - fast and reliable' 
                    : 'Not configured - add UPSTOX_API_KEY and UPSTOX_ACCESS_TOKEN to .env',
            }
        };
    }
}

module.exports = DataSourceManager;
