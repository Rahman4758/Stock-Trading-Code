const axios = require('axios');
const MacroData = require('../models/MacroData');

/**
 * MacroCollector
 * Fetches global inter-market indicators using direct Yahoo Finance API calls.
 * Bypasses library version issues.
 */
class MacroCollector {
    constructor() {
        this.symbols = {
            usd_inr: 'INR=X',
            gold_price: 'GC=F',
            brent_oil: 'BZ=F',
            us10y: '^TNX',
            dxy: 'DX-Y.NYB',
            sp500: '^GSPC',
            nasdaq: '^IXIC'
        };
        this.baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
    }

    /**
     * Fetch latest price for a symbol
     */
    async fetchLatest(symbol) {
        try {
            const url = `${this.baseUrl}/${symbol}?interval=1m&range=1d`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const result = response.data.chart.result[0];
            return result.meta.regularMarketPrice;
        } catch (err) {
            console.warn(`[MacroCollector] Failed to fetch ${symbol}:`, err.message);
            return null;
        }
    }

    /**
     * Fetch historical data for a symbol
     */
    async fetchHistory(symbol, days = 30) {
        try {
            const url = `${this.baseUrl}/${symbol}?interval=1d&range=${days}d`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const result = response.data.chart.result[0];
            const timestamps = result.timestamp;
            const quotes = result.indicators.quote[0].close;

            return timestamps.map((ts, i) => ({
                date: new Date(ts * 1000),
                close: quotes[i]
            })).filter(d => d.close !== null);
        } catch (err) {
            console.warn(`[MacroCollector] Failed to backfill ${symbol}:`, err.message);
            return [];
        }
    }

    /**
     * Fetch latest prices for all macro assets
     */
    async collect() {
        console.log('[MacroCollector] Fetching global market indicators (Direct API)...');
        const results = { date: new Date() };

        for (const [key, sym] of Object.entries(this.symbols)) {
            const price = await this.fetchLatest(sym);
            if (price) results[key] = price;
        }

        const today = new Date();
        today.setUTCHours(12, 0, 0, 0);

        const savedData = await MacroData.findOneAndUpdate(
            { date: today },
            { $set: { ...results, date: today } },
            { upsert: true, new: true }
        );

        console.log('[MacroCollector] Successfully updated macro data');
        return savedData;
    }

    /**
     * Backfill historical data
     */
    async backfill(days = 30) {
        console.log(`[MacroCollector] Backfilling last ${days} days (Direct API)...`);
        
        for (const [key, sym] of Object.entries(this.symbols)) {
            const history = await this.fetchHistory(sym, days);
            for (const row of history) {
                const rowDate = new Date(row.date);
                rowDate.setUTCHours(12, 0, 0, 0);

                await MacroData.findOneAndUpdate(
                    { date: rowDate },
                    { $set: { [key]: row.close } },
                    { upsert: true }
                );
            }
        }
        console.log('[MacroCollector] Backfill completed.');
    }
}

module.exports = MacroCollector;
