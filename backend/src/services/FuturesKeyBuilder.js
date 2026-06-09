/**
 * FuturesKeyBuilder
 * 
 * Downloads Upstox's daily complete.csv.gz instrument list and builds a
 * NSE_EQ_SYMBOL → NSE_FO_KEY map for all F&O-eligible stocks.
 * 
 * Key Problem Solved:
 * - Upstox equity endpoint (NSE_EQ|ISIN) does NOT return futures OI (always 0)
 * - Real futures OI requires the NSE_FO|<token> key, which uses numeric tokens
 * - Those tokens are only discoverable from the daily instrument CSV
 * 
 * Manual overrides handle stocks where NSE F&O symbol differs from NSE EQ symbol:
 *   TATAMOTORS → TMPV (Tata Motors Passenger Vehicles Limited)
 * 
 * Stocks NOT in F&O (no futures contract): TATACHEM, LTIM
 * For these, OI signal is derived from equity price action as best-effort.
 */
const axios = require('axios');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');

// Cache path for the built futures map (refresh daily)
const CACHE_PATH = path.join(__dirname, '..', 'data', 'futures_key_map.json');

/**
 * Known symbol remaps: NSE EQ symbol → F&O CSV symbol prefix
 * Add here when a stock's equity ticker differs from its F&O ticker.
 */
const SYMBOL_OVERRIDES = {
    'TATAMOTORS': 'TMPV',   // Tata Motors renamed to TMPV in F&O
};

/**
 * Stocks confirmed NOT eligible for F&O — will be flagged as equity-only
 */
const NON_FO_STOCKS = new Set(['TATACHEM', 'LTIM']);

class FuturesKeyBuilder {
    /**
     * Load cached futures map if fresh (within today), else rebuild from CSV.
     */
    async getFuturesMap(symbols) {
        // Try cache first
        if (fs.existsSync(CACHE_PATH)) {
            try {
                const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
                const cacheDate = cached._date;
                const today = new Date().toISOString().split('T')[0];
                if (cacheDate === today) {
                    console.log('[FuturesKeyBuilder] Using cached futures map from today');
                    return cached.map;
                }
            } catch (e) {
                console.warn('[FuturesKeyBuilder] Cache parse failed, rebuilding...');
            }
        }

        return this.buildAndCache(symbols);
    }

    /**
     * Download instrument CSV and build the key map.
     */
    async buildAndCache(symbols) {
        console.log('[FuturesKeyBuilder] Downloading instrument list...');

        const res = await axios.get(
            'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz',
            { responseType: 'arraybuffer', timeout: 60000 }
        );
        const csv = zlib.gunzipSync(res.data).toString();
        const lines = csv.split('\n');
        const today = new Date().toISOString().split('T')[0];

        const map = {};

        for (const sym of symbols) {
            if (NON_FO_STOCKS.has(sym)) {
                map[sym] = { key: null, expiry: null, tradingSymbol: null, isFo: false };
                continue;
            }

            // Determine the F&O prefix to search for
            const foPrefix = SYMBOL_OVERRIDES[sym] || sym;

            // Find all FUTSTK lines for this symbol (format: SYMBOL26MMMFUT or SYMBOL26JULFUT)
            const symLines = lines.filter(l => {
                return l.includes('FUTSTK') && l.includes('"' + foPrefix + '26');
            });

            // Parse CSV fields: key, token, tradingSymbol, name, ltp, expiry, ...
            const parsed = symLines
                .map(l => {
                    const parts = l.replace(/"/g, '').split(',');
                    return {
                        key: parts[0],
                        token: parts[1],
                        tradingSymbol: parts[2],
                        expiry: parts[5]
                    };
                })
                .filter(p => p.expiry && p.expiry >= today);

            // Pick nearest expiry (current month or rollover)
            parsed.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

            if (parsed[0]) {
                map[sym] = {
                    key: parsed[0].key,
                    expiry: parsed[0].expiry,
                    tradingSymbol: parsed[0].tradingSymbol,
                    isFo: true
                };
            } else {
                // Symbol exists on NSE but no active futures found (may be delisted from F&O)
                map[sym] = { key: null, expiry: null, tradingSymbol: null, isFo: false };
                console.warn(`[FuturesKeyBuilder] No active futures found for ${sym} (prefix: ${foPrefix})`);
            }
        }

        // Save cache
        fs.writeFileSync(CACHE_PATH, JSON.stringify({ _date: today, map }, null, 2));
        console.log(`[FuturesKeyBuilder] Built and cached map for ${Object.keys(map).length} symbols`);
        
        const mapped = Object.values(map).filter(v => v.isFo).length;
        const notMapped = Object.entries(map).filter(([, v]) => !v.isFo).map(([k]) => k);
        console.log(`[FuturesKeyBuilder] F&O eligible: ${mapped} | Not in F&O: ${notMapped.join(', ')}`);

        return map;
    }
}

module.exports = new FuturesKeyBuilder();
