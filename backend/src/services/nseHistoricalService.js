const axios = require('axios');
const csv = require('csv-parser');
const stream = require('stream');
const DailyPrice = require('../models/DailyPrice');
const Stock = require('../models/Stock');

class NseHistoricalService {
    constructor() {
        this.baseUrl = 'https://archives.nseindia.com';
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.nseindia.com/',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    }

    /**
     * Download and parse EOD Consolidated BhavCopy for a specific date
     * Contains OHLCV + Delivery %
     */
    async fetchBhavCopy(date = new Date()) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        const fileName = `sec_bhavdata_full_${day}${month}${year}.csv`;
        const url = `/products/content/${fileName}`;

        console.log(`[NSE-Historical] Attempting to fetch authentic BhavCopy: ${fileName}`);

        try {
            const response = await this.client({
                method: 'get',
                url: url,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                const results = [];
                response.data
                    .pipe(csv())
                    .on('data', (row) => {
                        // NSE Columns: SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, 
                        // LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QT, TURNOVER_LACS, 
                        // NO_OF_TRADES, DELIV_QTY, DELIV_PER
                        if (row.SERIES?.trim() === 'EQ') {
                            results.push({
                                symbol: row.SYMBOL?.trim(),
                                deliveryQty: parseInt(row.DELIV_QTY?.trim()) || 0,
                                deliveryPct: parseFloat(row.DELIV_PER?.trim()) || 0,
                                avgPrice: parseFloat(row.AVG_PRICE?.trim()) || 0, // Good proxy for EOD VWAP
                                totalVolume: parseInt(row.TTL_TRD_QT?.trim()) || 0
                            });
                        }
                    })
                    .on('end', () => resolve(results))
                    .on('error', (err) => reject(err));
            });
        } catch (err) {
            if (err.response?.status === 404) {
                console.warn(`[NSE-Historical] BhavCopy not available for ${year}-${month}-${day} (likely holiday or too early)`);
            } else {
                console.error(`[NSE-Historical] Network error fetching BhavCopy: ${err.message}`);
            }
            return [];
        }
    }

    /**
     * Sync delivery data from BhavCopy for active stocks
     */
    async syncDeliveryData(date = new Date()) {
        const data = await this.fetchBhavCopy(date);
        if (data.length === 0) return { updated: 0, total: 0 };

        const activeStocks = await Stock.find({ isActive: true }).select('symbol').lean();
        const activeSymbols = new Set(activeStocks.map(s => s.symbol));

        const filtered = data.filter(d => activeSymbols.has(d.symbol));
        let updatedCount = 0;

        const targetDate = new Date(date);
        targetDate.setUTCHours(12, 0, 0, 0);

        for (const record of filtered) {
            const result = await DailyPrice.findOneAndUpdate(
                { symbol: record.symbol, date: targetDate },
                { 
                    $set: { 
                        deliveryQty: record.deliveryQty,
                        deliveryPct: record.deliveryPct,
                        avgPrice: record.avgPrice
                    } 
                },
                { upsert: false } // Only update existing price entries
            );
            if (result) updatedCount++;
        }

        console.log(`[NSE-Historical] Synced delivery data for ${updatedCount} stocks.`);
        return { updated: updatedCount, total: activeSymbols.size };
    }
}

module.exports = new NseHistoricalService();
