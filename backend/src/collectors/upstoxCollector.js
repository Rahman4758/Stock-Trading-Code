/**
 * Upstox API Collector
 * Official broker API - reliable, fast, all data types
 * Requires: UPSTOX_API_KEY, UPSTOX_API_SECRET, UPSTOX_ACCESS_TOKEN in .env
 * 
 * Documentation: https://upstox.com/developer/api-documentation/
 */
const axios = require('axios');
const Stock = require('../models/Stock');
const DailyPrice = require('../models/DailyPrice');
const OiData = require('../models/OiData');

class UpstoxCollector {
    constructor() {
        this.apiKey = process.env.UPSTOX_API_KEY;
        this.accessToken = process.env.UPSTOX_ACCESS_TOKEN;
        this.baseUrl = 'https://api.upstox.com/v2';
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 15000,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
            }
        });

        // Load the dynamically synced ISIN mappings
        this.instrumentMap = {};
        try {
            const fs = require('fs');
            const path = require('path');
            const mapPath = path.join(__dirname, '..', 'data', 'upstox_instruments.json');
            if (fs.existsSync(mapPath)) {
                this.instrumentMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            }
        } catch (e) {
            console.error('[Upstox] Failed to load instrument map:', e.message);
        }
    }

    /**
     * Check if Upstox credentials are configured
     */
    isConfigured() {
        return !!(this.apiKey && this.accessToken);
    }

    /**
     * Convert NSE symbol to Upstox instrument key format (ISIN required for v2 API)
     * Format: NSE_EQ|ISIN for equity
     */
    toUpstoxKey(symbol, segment = 'EQ') {
        const mappedKey = this.instrumentMap[symbol];
        if (mappedKey) return mappedKey; // Already contains segment prefix
        
        // Fallback for symbols not in map (likely will fail Upstox validation but better than double prefix)
        return `NSE_${segment}|${symbol}`;
    }

    /**
     * Get market quote for multiple instruments
     */
    async getQuotes(symbols) {
        try {
            const instrumentKeys = symbols.map(s => this.toUpstoxKey(s)).join(',');
            const response = await this.client.get('/market-quote/quotes', {
                params: { instrument_key: instrumentKeys }
            });
            return response.data.data || {};
        } catch (err) {
            console.error(`[Upstox] Quote error: ${err.response?.data?.message || err.message}`);
            return {};
        }
    }

    /**
     * Get historical OHLCV data
     */
    async getHistoricalData(symbol, interval = 'day', days = 60) {
        try {
            const toDate = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const response = await this.client.get('/historical-candle/' + 
                encodeURIComponent(this.toUpstoxKey(symbol)) + 
                `/${interval}/${toDate}/${fromDate}`
            );
            
            // Response format: [timestamp, open, high, low, close, volume, oi]
            const candles = response.data.data?.candles || [];
            
            return candles.map(c => {
                // Safely extract just the YYYY-MM-DD to avoid all timezone drift math later
                const rawDateString = typeof c[0] === 'string' ? c[0] : new Date(c[0]).toISOString();
                const dateStr = rawDateString.split('T')[0];
                
                return {
                    dateStr,
                    date: new Date(c[0]),
                    open: c[1],
                    high: c[2],
                    low: c[3],
                    close: c[4],
                    volume: c[5],
                    oi: c[6] || 0,
                };
            });
        } catch (err) {
            console.error(`[Upstox] Historical error ${symbol}: ${err.response?.data?.message || err.message}`);
            return [];
        }
    }

    /**
     * Get option chain data
     */
    async getOptionChain(symbol) {
        try {
            const response = await this.client.get('/option/chain', {
                params: { 
                    instrument_key: this.toUpstoxKey(symbol),
                    expiry_date: this.getNextExpiry()
                }
            });
            
            const data = response.data.data || [];
            let callOi = 0, putOi = 0;
            
            for (const strike of data) {
                if (strike.call_options) callOi += strike.call_options.market_data?.oi || 0;
                if (strike.put_options) putOi += strike.put_options.market_data?.oi || 0;
            }
            
            return {
                callOi,
                putOi,
                pcr: callOi > 0 ? parseFloat((putOi / callOi).toFixed(4)) : null,
            };
        } catch (err) {
            console.error(`[Upstox] Option chain error ${symbol}: ${err.response?.data?.message || err.message}`);
            return null;
        }
    }

    /**
     * Get next monthly expiry date
     */
    getNextExpiry() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        // Find last Thursday of current month
        let lastThursday = new Date(year, month + 1, 0);
        while (lastThursday.getDay() !== 4) {
            lastThursday.setDate(lastThursday.getDate() - 1);
        }
        
        // If past this month's expiry, get next month's
        if (today > lastThursday) {
            lastThursday = new Date(year, month + 2, 0);
            while (lastThursday.getDay() !== 4) {
                lastThursday.setDate(lastThursday.getDate() - 1);
            }
        }
        
        return lastThursday.toISOString().split('T')[0];
    }

    /**
     * Calculate technical indicators
     */
    calculateIndicators(candles) {
        if (candles.length < 20) return {};
        
        const closes = candles.map(c => c.close);
        
        const sma = (n) => {
            if (closes.length < n) return null;
            return parseFloat((closes.slice(0, n).reduce((a, b) => a + b, 0) / n).toFixed(2));
        };
        
        let atr14 = null;
        if (closes.length >= 15) {
            const tr = [];
            for (let i = 0; i < 14; i++) {
                const high = candles[i].high;
                const low = candles[i].low;
                const prevClose = candles[i + 1].close;
                tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
            }
            atr14 = parseFloat((tr.reduce((a, b) => a + b, 0) / 14).toFixed(2));
        }
        
        return { sma20: sma(20), sma50: sma(50), sma200: sma(200), atr14 };
    }

    /**
     * Batch-fetch today's live OHLCV for multiple symbols via market-quote.
     * Upstox allows up to 500 instrument keys per call.
     * Used to patch the gap when historical-candle API hasn't published today's EOD yet.
     * @param {string[]} instrumentKeys  Array of 'NSE_EQ|ISIN' keys
     * @returns {Object} map of instrumentKey -> { open, high, low, close, volume, dateStr }
     */
    async getTodayQuotes(instrumentKeys) {
        const result = {};
        const todayStr = new Date().toISOString().split('T')[0];
        const BATCH = 500;

        for (let i = 0; i < instrumentKeys.length; i += BATCH) {
            const batch = instrumentKeys.slice(i, i + BATCH);
            try {
                const response = await this.client.get('/market-quote/quotes', {
                    params: { instrument_key: batch.join(',') }
                });
                const data = response.data?.data || {};
                // Response keys are 'NSE_EQ:SYMBOL' (colon-separated) regardless of input format
                for (const [responseKey, q] of Object.entries(data)) {
                    if (q?.ohlc) {
                        const quote = {
                            dateStr: todayStr,
                            open: q.ohlc.open,
                            high: q.ohlc.high,
                            low: q.ohlc.low,
                            close: q.ohlc.close || q.last_price,
                            volume: q.volume || 0,
                        };
                        // Index by response key (NSE_EQ:SYMBOL) for fast lookup
                        result[responseKey] = quote;
                    }
                }
            } catch (err) {
                console.warn(`[Upstox] getTodayQuotes batch failed: ${err.response?.data?.message || err.message}`);
            }
        }
        return result;
    }

    /**
     * Collect price data for all stocks.
     * Strategy:
     *   1. Fetch historical OHLCV via /historical-candle (lags by ~1 day).
     *   2. If today's candle is missing, patch it from /market-quote/quotes (live).
     * This ensures the DB always has today's close after a sync runs post-market.
     */
    async collectPrices({ days = 60 } = {}) {
        if (!this.isConfigured()) {
            throw new Error('Upstox API not configured. Set UPSTOX_API_KEY and UPSTOX_ACCESS_TOKEN in .env');
        }

        const stocks = await Stock.find({ isActive: true }).select('symbol').lean();
        const todayStr = new Date().toISOString().split('T')[0];
        let saved = 0, failed = 0;

        // Determine today's target date string for matching
        const targetDateStr = new Date().toISOString().split('T')[0];

        for (const stock of stocks) {
            try {
                const candles = await this.getHistoricalData(stock.symbol, 'day', days);
                
                // --- PATCH MISSING TODAY CANDLE ---
                // If historical-candle hasn't published today's EOD yet, fetch it via market-quote
                let latestCandleDate = candles.length > 0 ? candles[0].dateStr : null;
                if (latestCandleDate !== targetDateStr) {
                    const todayQuoteMap = await this.getTodayQuotes([this.toUpstoxKey(stock.symbol)]);
                    const todayQuote = Object.values(todayQuoteMap)[0];
                    if (todayQuote) {
                        candles.unshift({
                            dateStr: todayQuote.dateStr,
                            date: new Date(todayQuote.dateStr + 'T12:00:00.000Z'),
                            open: todayQuote.open,
                            high: todayQuote.high,
                            low: todayQuote.low,
                            close: todayQuote.close,
                            volume: todayQuote.volume,
                            oi: 0
                        });
                    }
                }

                if (candles.length === 0) {
                    failed++;
                    continue;
                }

                // Sort by date descending (most recent first)
                candles.sort((a, b) => b.date - a.date);

                const indicators = this.calculateIndicators(candles);

                // Save each day
                for (let i = 0; i < candles.length; i++) {
                    const candle = candles[i];

                    // Foolproof date parsing: bypasses system timezone offsets
                    const [year, month, day] = candle.dateStr.split('-');
                    const date = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), 12, 0, 0, 0));

                    await DailyPrice.findOneAndUpdate(
                        { symbol: stock.symbol, date },
                        {
                            $set: {
                                symbol: stock.symbol,
                                date,
                                open: candle.open,
                                high: candle.high,
                                low: candle.low,
                                close: candle.close,
                                volume: candle.volume,
                                ...(i === 0 ? indicators : {}),
                            },
                            $setOnInsert: {
                                deliveryPct: 0
                            }
                        },
                        { upsert: true }
                    );
                }

                saved++;
                const latest = candles[0];
                console.log(`[Upstox] ${stock.symbol}: ${candles.length} days | Latest: ₹${latest.close} (${latest.dateStr})`);

                await new Promise(r => setTimeout(r, 100));

            } catch (err) {
                console.error(`[Upstox] Error ${stock.symbol}: ${err.message}`);
                failed++;
            }
        }

        return { saved, failed, total: stocks.length };
    }


    /**
     * Collect OI data for F&O stocks
     */
    async collectOiData() {
        if (!this.isConfigured()) {
            throw new Error('Upstox API not configured');
        }

        const FuturesKeyBuilder = require('../services/FuturesKeyBuilder');
        const stocks = await Stock.find({ isActive: true, isFno: true }).select('symbol').lean();
        const symbols = stocks.map(s => s.symbol);

        // EOD SWING TRADING: Always save under the expected completed trading date
        const marketCalendar = require('../services/MarketCalendar');
        const expectedStr = marketCalendar.expectedDataDate();
        const targetDate = new Date(expectedStr);
        targetDate.setUTCHours(12, 0, 0, 0);

        // Build / load futures key map (cached per day)
        const futuresMap = await FuturesKeyBuilder.getFuturesMap(symbols);

        let saved = 0, failed = 0;

        for (const stock of stocks) {
            try {
                const futInfo = futuresMap[stock.symbol];
                
                let futureOi = 0;
                let futureOiChange = 0;
                let futureOiChangePct = 0;
                let oiSignal = 'NEUTRAL';
                let priceChange = 0;

                if (futInfo?.isFo && futInfo.key) {
                    // ---- REAL FUTURES OI FROM UPSTOX ----
                    const fromDate = new Date();
                    fromDate.setDate(fromDate.getDate() - 7);
                    const toStr = new Date().toISOString().split('T')[0];
                    const fromStr = fromDate.toISOString().split('T')[0];

                    let candles = [];
                    try {
                        const res = await this.client.get(
                            '/historical-candle/' + encodeURIComponent(futInfo.key) + `/day/${toStr}/${fromStr}`
                        );
                        // Format: [timestamp, open, high, low, close, volume, oi]
                        candles = (res.data?.data?.candles || []).map(c => ({
                            close: c[4],
                            volume: c[5],
                            oi: c[6] || 0
                        }));
                    } catch (fetchErr) {
                        console.warn(`[Upstox-OI] ${stock.symbol}: futures candle fetch failed (${fetchErr.message}), skipping`);
                        failed++;
                        continue;
                    }

                    if (candles.length < 2) {
                        console.warn(`[Upstox-OI] ${stock.symbol}: insufficient futures candles`);
                        failed++;
                        continue;
                    }

                    const latest = candles[0];
                    const prev = candles[1];
                    futureOi = latest.oi;
                    futureOiChange = latest.oi - prev.oi;
                    futureOiChangePct = prev.oi > 0
                        ? parseFloat(((futureOiChange / prev.oi) * 100).toFixed(2))
                        : 0;
                    priceChange = latest.close - prev.close;

                } else {
                    // ---- NON-F&O STOCK: derive from equity price action ----
                    console.log(`[Upstox-OI] ${stock.symbol}: not in F&O — deriving signal from equity price action`);
                    const equityCandles = await this.getHistoricalData(stock.symbol, 'day', 5);
                    if (equityCandles.length >= 2) {
                        priceChange = equityCandles[0].close - equityCandles[1].close;
                        futureOi = 0;
                        futureOiChange = 0;
                        futureOiChangePct = 0;
                    }
                }

                // OI Signal classification
                if (priceChange > 0 && futureOiChange > 0) oiSignal = 'LONG_BUILDUP';
                else if (priceChange < 0 && futureOiChange > 0) oiSignal = 'SHORT_BUILDUP';
                else if (priceChange > 0 && futureOiChange < 0) oiSignal = 'SHORT_COVERING';
                else if (priceChange < 0 && futureOiChange < 0) oiSignal = 'LONG_UNWINDING';
                else if (priceChange > 0) oiSignal = 'BULLISH';
                else if (priceChange < 0) oiSignal = 'BEARISH';

                // Get option chain PCR, Max Pain, and Top Strikes (best-effort for F&O stocks)
                let callOi = 0, putOi = 0, pcr = 1.0, maxPain = 0, topPutStrikes = [], topCallStrikes = [];
                if (futInfo?.isFo && futInfo.expiry) {
                    const optionData = await this.getOptionChainWithExpiry(
                        this.toUpstoxKey(stock.symbol), futInfo.expiry
                    );
                    if (optionData) {
                        callOi = optionData.callOi;
                        putOi = optionData.putOi;
                        pcr = optionData.pcr || 1.0;
                        maxPain = optionData.maxPain || 0;
                        topPutStrikes = optionData.topPutStrikes || [];
                        topCallStrikes = optionData.topCallStrikes || [];
                    }
                }

                await OiData.findOneAndUpdate(
                    { symbol: stock.symbol, date: targetDate },
                    {
                        $set: {
                            symbol: stock.symbol,
                            date: targetDate,
                            futureOi,
                            futureOiChange,
                            futureOiChangePct,
                            oiChangePct: futureOiChangePct,
                            callOi,
                            putOi,
                            pcr,
                            maxPain,
                            topPutStrikes,
                            topCallStrikes,
                            oiSignal,
                            isFo: futInfo?.isFo || false,
                        }
                    },
                    { upsert: true }
                );

                saved++;
                console.log(`[Upstox-OI] ${stock.symbol}: OI=${futureOi.toLocaleString()} | Chg=${futureOiChangePct}% | PCR=${pcr.toFixed(2)} | Signal=${oiSignal}`);

                await new Promise(r => setTimeout(r, 150));

            } catch (err) {
                console.error(`[Upstox-OI] Error ${stock.symbol}: ${err.message}`);
                failed++;
            }
        }

        return { saved, failed, total: stocks.length };
    }

    /**
     * Get option chain with a specific expiry date (avoids expired-contract 404s)
     */
    async getOptionChainWithExpiry(instrumentKey, expiryDate) {
        try {
            const response = await this.client.get('/option/chain', {
                params: { instrument_key: instrumentKey, expiry_date: expiryDate }
            });

            const data = response.data.data || [];
            let callOi = 0, putOi = 0;
            
            let allPuts = [];
            let allCalls = [];
            let strikesList = [];

            for (const strike of data) {
                const strikePrice = strike.strike_price;
                strikesList.push(strikePrice);
                
                if (strike.call_options && strike.call_options.market_data) {
                    const md = strike.call_options.market_data;
                    callOi += md.oi || 0;
                    // Usually we don't have historical OI in live chain, so we assume today's OI as proxy or calculate from volume.
                    // For now, save current OI.
                    allCalls.push({ strike: strikePrice, oi: md.oi || 0, oiChange: 0 }); 
                }
                if (strike.put_options && strike.put_options.market_data) {
                    const md = strike.put_options.market_data;
                    putOi += md.oi || 0;
                    allPuts.push({ strike: strikePrice, oi: md.oi || 0, oiChange: 0 });
                }
            }
            
            // Calculate Max Pain
            let minLoss = Infinity;
            let maxPain = 0;
            
            for (const testStrike of strikesList) {
                let totalLoss = 0;
                for (const strike of data) {
                    const pStrike = strike.strike_price;
                    if (strike.call_options && strike.call_options.market_data) {
                        const cOi = strike.call_options.market_data.oi || 0;
                        if (testStrike > pStrike) totalLoss += (testStrike - pStrike) * cOi;
                    }
                    if (strike.put_options && strike.put_options.market_data) {
                        const pOi = strike.put_options.market_data.oi || 0;
                        if (testStrike < pStrike) totalLoss += (pStrike - testStrike) * pOi;
                    }
                }
                if (totalLoss < minLoss) {
                    minLoss = totalLoss;
                    maxPain = testStrike;
                }
            }

            allPuts.sort((a, b) => b.oi - a.oi);
            allCalls.sort((a, b) => b.oi - a.oi);

            return {
                callOi,
                putOi,
                pcr: callOi > 0 ? parseFloat((putOi / callOi).toFixed(4)) : null,
                maxPain,
                topPutStrikes: allPuts.slice(0, 3),
                topCallStrikes: allCalls.slice(0, 3)
            };
        } catch (err) {
            console.debug(`[Upstox] Option chain error ${instrumentKey}@${expiryDate}: ${err.response?.data?.errors?.[0]?.message || err.message}`);
            return null;
        }
    }

}

module.exports = UpstoxCollector;

