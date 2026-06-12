/**
 * OI Data Collector
 * Fetches NSE futures Open Interest data per stock
 * Source: NSE public API — uses session cookies
 */
const BaseCollector = require('./base');
const OiData = require('../models/OiData');
const DailyPrice = require('../models/DailyPrice');
const Stock = require('../models/Stock');

class OiCollector extends BaseCollector {
    constructor() {
        super({
            sourceName: 'NSE_OI',
            baseUrl: 'https://www.nseindia.com',
            rateLimitCalls: 5,
            rateLimitPeriod: 60000,
        });
    }

    /**
     * Determine OI signal based on price vs OI direction
     */
    _classifyOiSignal(priceChange, oiChange) {
        if (oiChange === null || oiChange === undefined) return 'NEUTRAL';
        if (priceChange > 0 && oiChange > 0) return 'LONG_BUILDUP';
        if (priceChange < 0 && oiChange > 0) return 'SHORT_BUILDUP';
        if (priceChange > 0 && oiChange < 0) return 'SHORT_COVERING';
        if (priceChange < 0 && oiChange < 0) return 'LONG_UNWINDING';
        return 'NEUTRAL';
    }

    /**
     * Fetch OI for a single F&O stock
     */
    async fetchStockOi(symbol) {
        try {
            // NSE derivatives quote endpoint
            const data = await this.request('GET', '/api/quote-derivative', { symbol });
            const futData = (data.stocks || []).find(
                (s) => s.metadata?.instrumentType === 'Stock Futures' && s.metadata?.expiryDate
            );

            if (!futData) return null;

            const oi = parseInt(futData.marketDeptOrderBook?.tradeInfo?.totalTradedVolume) || 0;
            const oiChange = parseInt(futData.marketDeptOrderBook?.otherInfo?.openInterestChange) || 0;
            const otherOi = futData.marketDeptOrderBook?.otherInfo?.openInterest || 0;

            return {
                futureOi: parseInt(otherOi) || 0,
                futureOiChange: oiChange,
                futureOiChangePct: otherOi ? parseFloat(((oiChange / otherOi) * 100).toFixed(2)) : 0,
            };
        } catch (err) {
            console.debug(`[OI] No data for ${symbol}: ${err.message}`);
            return null;
        }
    }

    /**
     * Fetch options aggregate (call OI + put OI) for PCR
     */
    async fetchOptionsPcr(symbol, isIndex = false) {
        try {
            const endpoint = isIndex ? '/api/option-chain-indices' : '/api/option-chain-equities';
            const data = await this.request('GET', endpoint, { symbol });
            const records = data.records?.data || [];

            let callOi = 0, putOi = 0;
            let strikesList = [];
            let allPuts = [];
            let allCalls = [];

            for (const row of records) {
                const strikePrice = row.strikePrice;
                if (!strikePrice) continue;
                strikesList.push(strikePrice);

                if (row.CE) {
                    const cOi = row.CE.openInterest || 0;
                    callOi += cOi;
                    allCalls.push({ strike: strikePrice, oi: cOi, oiChange: row.CE.changeinOpenInterest || 0 });
                }
                if (row.PE) {
                    const pOi = row.PE.openInterest || 0;
                    putOi += pOi;
                    allPuts.push({ strike: strikePrice, oi: pOi, oiChange: row.PE.changeinOpenInterest || 0 });
                }
            }

            // Calculate Max Pain
            let minLoss = Infinity;
            let maxPain = 0;
            
            for (const testStrike of strikesList) {
                let totalLoss = 0;
                for (const row of records) {
                    const pStrike = row.strikePrice;
                    if (row.CE) {
                        const cOi = row.CE.openInterest || 0;
                        if (testStrike > pStrike) totalLoss += (testStrike - pStrike) * cOi;
                    }
                    if (row.PE) {
                        const pOi = row.PE.openInterest || 0;
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
        } catch {
            return { callOi: 0, putOi: 0, pcr: null, maxPain: 0, topPutStrikes: [], topCallStrikes: [] };
        }
    }

    async collect({ symbols = null, date = null } = {}) {
        await this.initCookies();

        // Normalize to 12:00 UTC — same convention as DailyPrice
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setUTCHours(12, 0, 0, 0);

        if (!symbols) {
            const stocks = await Stock.find({ isActive: true, isFno: true }).select('symbol');
            symbols = stocks.map((s) => s.symbol);
            if (!symbols.includes("NIFTY")) {
                symbols.push("NIFTY");
            }
        }

        let saved = 0, failed = 0;

        for (const symbol of symbols) {
            try {
                const isIndex = symbol === "NIFTY";
                const dbSymbol = isIndex ? "NIFTY50" : symbol;

                const [oiData, pcrData] = await Promise.all([
                    this.fetchStockOi(symbol),
                    this.fetchOptionsPcr(symbol, isIndex),
                ]);

                if (!oiData && !isIndex) { failed++; continue; }
                const safeOiData = oiData || { futureOi: 0, futureOiChange: 0, futureOiChangePct: 0 };

                // Get today's price change for OI signal classification
                const todayPrice = await DailyPrice.findOne({ symbol: dbSymbol, date: targetDate }).lean();
                const prevDate = new Date(targetDate);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevPrice = await DailyPrice.findOne({
                    symbol: dbSymbol,
                    date: { $lte: prevDate },
                }).sort({ date: -1 }).lean();

                let priceChange = 0;
                if (todayPrice?.close && prevPrice?.close) {
                    priceChange = todayPrice.close - prevPrice.close;
                }

                const oiSignal = this._classifyOiSignal(priceChange, safeOiData.futureOiChange);

                await OiData.findOneAndUpdate(
                    { symbol: dbSymbol, date: targetDate },
                    {
                        $set: {
                            symbol: dbSymbol,
                            date: targetDate,
                            ...safeOiData,
                            ...pcrData,
                            oiChangePct: safeOiData.futureOiChangePct, // alias for moneyFlowService
                            maxPain: pcrData.maxPain || 0,
                            topPutStrikes: pcrData.topPutStrikes || [],
                            topCallStrikes: pcrData.topCallStrikes || [],
                            oiSignal,
                        },
                    },
                    { upsert: true, new: true }
                );

                saved++;
                console.log(`[OI] ${dbSymbol}: OI ${safeOiData.futureOi} | Change ${safeOiData.futureOiChangePct}% | Signal: ${oiSignal} | PCR: ${pcrData.pcr}`);
            } catch (err) {
                console.error(`[OI] Failed ${symbol}: ${err.message}`);
                failed++;
            }
        }

        return { saved, failed, total: symbols.length };
    }
}

module.exports = OiCollector;
