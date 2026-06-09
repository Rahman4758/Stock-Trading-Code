/**
 * MarketFiiDiiCollector
 * 
 * Fetches real daily FII/DII summary from NSE's public API
 * (no puppeteer required — plain HTTPS GET with proper headers).
 * 
 * Endpoint: https://www.nseindia.com/api/fiidiiTradeReact
 * Saves as TOTAL_MARKET records in FiiDiiData collection.
 */
const axios = require('axios');
const FiiDiiData = require('../models/FiiDiiData');

const NSE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nseindia.com/',
    'X-Requested-With': 'XMLHttpRequest',
    'Connection': 'keep-alive',
};

class MarketFiiDiiCollector {
    /**
     * Fetch and store the last N days of TOTAL_MARKET FII/DII data.
     */
    async collect({ days = 10 } = {}) {
        // Step 1: Get a session cookie by visiting the homepage first
        const session = axios.create({
            baseURL: 'https://www.nseindia.com',
            headers: NSE_HEADERS,
            timeout: 15000,
            withCredentials: true,
        });

        try {
            // Warm up cookie (NSE blocks without valid session)
            await session.get('/');
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.warn('[MarketFiiDii] Cookie warmup failed, trying anyway:', e.message);
        }

        // Step 2: Fetch FII/DII data
        let rawData;
        try {
            const resp = await session.get('/api/fiidiiTradeReact');
            rawData = resp.data;
        } catch (e) {
            console.error('[MarketFiiDii] Failed to fetch FII/DII:', e.message);
            return { saved: 0, error: e.message };
        }

        // Step 3: Parse and save records
        // NSE returns a flat array: [{category:'FII', date:'29-Apr-2026', buyValue, sellValue, netValue}, {category:'DII', ...}]
        // Group by date, then extract FII and DII rows.
        const records = Array.isArray(rawData) ? rawData : (rawData?.data || []);
        
        // Group entries by date string
        const byDate = {};
        for (const row of records) {
            const dateStr = row.date;
            if (!dateStr) continue;
            if (!byDate[dateStr]) byDate[dateStr] = [];
            byDate[dateStr].push(row);
        }

        let saved = 0;

        for (const [dateStr, entries] of Object.entries(byDate)) {
            try {
                const parsedDate = this._parseNseDate(dateStr);
                if (!parsedDate) continue;

                let fiiNet = 0, diiNet = 0, fiiBuy = 0, fiiSell = 0, diiBuy = 0, diiSell = 0;

                for (const entry of entries) {
                    const cat = (entry.category || '').toLowerCase();
                    // NSE values are in Cr — convert to rupees (×10^7) for storage consistency
                    const CrToRupees = 10000000;
                    const buyVal  = parseFloat(entry.buyValue  || 0) * CrToRupees;
                    const sellVal = parseFloat(entry.sellValue || 0) * CrToRupees;
                    const netVal  = parseFloat(entry.netValue  || 0) * CrToRupees;

                    if (cat.includes('fii') || cat.includes('fpi')) {
                        fiiNet = netVal; fiiBuy = buyVal; fiiSell = sellVal;
                    } else if (cat.includes('dii')) {
                        diiNet = netVal; diiBuy = buyVal; diiSell = sellVal;
                    }
                }

                const doc = {
                    symbol: 'TOTAL_MARKET',
                    date: parsedDate,
                    fiiGrossBuy:  Math.round(fiiBuy),
                    fiiGrossSell: Math.round(fiiSell),
                    fiiNet:       Math.round(fiiNet),
                    diiGrossBuy:  Math.round(diiBuy),
                    diiGrossSell: Math.round(diiSell),
                    diiNet:       Math.round(diiNet),
                    combinedNet:  Math.round(fiiNet + diiNet),
                };

                await FiiDiiData.findOneAndUpdate(
                    { symbol: 'TOTAL_MARKET', date: parsedDate },
                    { $set: doc },
                    { upsert: true }
                );
                console.log(`[MarketFiiDii] ${dateStr}: FII=${(fiiNet/10000000).toFixed(0)}Cr  DII=${(diiNet/10000000).toFixed(0)}Cr`);
                saved++;
            } catch (e) {
                console.warn('[MarketFiiDii] Row error:', e.message);
            }
        }

        return { saved, total: records.length };
    }

    /**
     * Parse NSE date formats: "29-Apr-2026", "2026-04-29", "29Apr2026"
     */
    _parseNseDate(str) {
        if (!str) return null;
        const s = str.trim();

        // ISO format
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const d = new Date(s);
            d.setUTCHours(12, 0, 0, 0);
            return isNaN(d) ? null : d;
        }

        // "29-Apr-2026" format
        const match = s.match(/^(\d{1,2})[- ]?([A-Za-z]{3})[- ]?(\d{4})$/);
        if (match) {
            const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
            const d = new Date(Date.UTC(
                parseInt(match[3]),
                months[match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()] ?? 0,
                parseInt(match[1]),
                12, 0, 0, 0
            ));
            return isNaN(d) ? null : d;
        }

        return null;
    }
}

module.exports = new MarketFiiDiiCollector();
