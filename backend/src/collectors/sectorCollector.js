/**
 * Sector Index Collector
 * Fetches Nifty sectoral index closing values from NSE public API or Upstox API
 */
const BaseCollector = require('./base');
const SectorIndex = require('../models/SectorIndex');
const UpstoxCollector = require('./upstoxCollector');

// Map NSE index names to our internal names
const SECTOR_INDICES = [
    { nse: 'NIFTY 50', internal: 'NIFTY50' },
    { nse: 'NIFTY BANK', internal: 'NIFTY_BANK' },
    { nse: 'NIFTY IT', internal: 'NIFTY_IT' },
    { nse: 'NIFTY AUTO', internal: 'NIFTY_AUTO' },
    { nse: 'NIFTY PHARMA', internal: 'NIFTY_PHARMA' },
    { nse: 'NIFTY FMCG', internal: 'NIFTY_FMCG' },
    { nse: 'NIFTY METAL', internal: 'NIFTY_METAL' },
    { nse: 'NIFTY ENERGY', internal: 'NIFTY_ENERGY' },
    { nse: 'NIFTY REALTY', internal: 'NIFTY_REALTY' },
    { nse: 'NIFTY INFRA', internal: 'NIFTY_INFRA' },
    { nse: 'NIFTY MEDIA', internal: 'NIFTY_MEDIA' },
    { nse: 'NIFTY HEALTHCARE INDEX', internal: 'NIFTY_HEALTHCARE' },
    { nse: 'NIFTY FINANCIAL SERVICES', internal: 'NIFTY_FINANCIAL' },
    { nse: 'INDIA VIX', internal: 'INDIA_VIX' },
];

class SectorCollector extends BaseCollector {
    constructor() {
        super({
            sourceName: 'NSE_SECTOR',
            baseUrl: 'https://www.nseindia.com',
            rateLimitCalls: 5,
            rateLimitPeriod: 60000,
        });
        this.upstox = new UpstoxCollector();
    }

    /**
     * Compute 10-day RS vs Nifty50 for a sector
     * Returns: percentage outperformance (positive = sector stronger)
     */
    async computeSectorRs(indexName, currentClose) {
        const history = await SectorIndex.find({ indexName })
            .sort({ date: -1 })
            .limit(10)
            .lean();

        const niftyHistory = await SectorIndex.find({ indexName: 'NIFTY50' })
            .sort({ date: -1 })
            .limit(10)
            .lean();

        if (history.length < 5 || niftyHistory.length < 5) return { rsVsNifty: 100, rsTrend: 'NEUTRAL' };

        const sectorBase = history[history.length - 1].close;
        const niftyBase = niftyHistory[niftyHistory.length - 1].close;
        const niftyCurrent = niftyHistory[0].close;

        const sectorReturn = (currentClose - sectorBase) / sectorBase;
        const niftyReturn = (niftyCurrent - niftyBase) / niftyBase;

        const rs = parseFloat((100 + (sectorReturn - niftyReturn) * 100).toFixed(2));

        // Compare to 5-day ago RS for trend
        const sectorBase5 = history[4]?.close || sectorBase;
        const niftyBase5 = niftyHistory[4]?.close || niftyBase;
        const niftyCurr5 = niftyHistory[0]?.close || niftyCurrent;
        const prevSectorRet = (history[0]?.close - sectorBase5) / sectorBase5;
        const prevNiftyRet = (niftyCurr5 - niftyBase5) / niftyBase5;
        const prevRs = 100 + (prevSectorRet - prevNiftyRet) * 100;

        const rsTrend = rs > prevRs ? 'STRENGTHENING' : rs < prevRs ? 'WEAKENING' : 'NEUTRAL';
        const rotationSignal =
            rsTrend === 'STRENGTHENING' && rs > 101 ? 'ROTATING_IN' :
                rsTrend === 'WEAKENING' && rs < 99 ? 'ROTATING_OUT' : 'NEUTRAL';

        return { rsVsNifty: rs, rsTrend, rotationSignal };
    }

    async collect({ date = null } = {}) {
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setUTCHours(12, 0, 0, 0);

        let allIndices = [];

        // Try Upstox first if configured
        if (this.upstox.isConfigured()) {
            console.log('[Sector] Using Upstox for live quotes...');
            const quotes = await this.upstox.getQuotes(SECTOR_INDICES.map(s => s.internal));
            allIndices = Object.entries(quotes).map(([key, val]) => ({
                index: SECTOR_INDICES.find(s => s.internal === key)?.nse || key,
                last: val.last_price,
                open: val.ohlc?.open,
                high: val.ohlc?.high,
                low: val.ohlc?.low,
                turnover: val.volume
            }));
        }

        // Fallback to NSE if Upstox failed or not used
        if (allIndices.length === 0) {
            try {
                await this.initCookies();
                const data = await this.request('GET', '/api/allIndices');
                allIndices = data.data || [];
            } catch (err) {
                console.error('[Sector] NSE Fallback failed:', err.message);
            }
        }

        let saved = 0, skipped = 0;

        for (const indexMap of SECTOR_INDICES) {
            const found = allIndices.find((idx) => idx.index === indexMap.nse || idx.index === indexMap.internal);
            if (!found) { skipped++; continue; }

            const close = parseFloat(found.last);
            const rsData = await this.computeSectorRs(indexMap.internal, close);

            await SectorIndex.findOneAndUpdate(
                { indexName: indexMap.internal, date: targetDate },
                {
                    $set: {
                        indexName: indexMap.internal,
                        date: targetDate,
                        open: parseFloat(found.open) || close,
                        high: parseFloat(found.high) || close,
                        low: parseFloat(found.low) || close,
                        close,
                        volume: parseFloat(found.turnover) || 0,
                        ...rsData,
                    },
                },
                { upsert: true, new: true }
            );

            saved++;
            console.log(`[Sector] ${indexMap.internal}: ₹${close} | RS: ${rsData.rsVsNifty} | ${rsData.rsTrend}`);
        }

        return { saved, skipped, total: SECTOR_INDICES.length };
    }

    /**
     * Sync historical data for all sector indices
     */
    async syncHistory(days = 30) {
        for (const indexMap of SECTOR_INDICES) {
            try {
                console.log(`[Sector] Syncing history for ${indexMap.internal}...`);
                let records = [];

                if (this.upstox.isConfigured()) {
                    const candles = await this.upstox.getHistoricalData(indexMap.internal, 'day', days);
                    records = candles.map(c => ({
                        EOD_TIMESTAMP: c.date,
                        EOD_OPEN_INDEX_VAL: c.open,
                        EOD_HIGH_INDEX_VAL: c.high,
                        EOD_LOW_INDEX_VAL: c.low,
                        EOD_CLOSE_INDEX_VAL: c.close,
                        HIT_TURN_OVER: c.volume
                    }));
                }

                // Fallback to NSE
                if (records.length === 0) {
                    try {
                        await this.initCookies();
                        const toDate = new Date();
                        const fromDate = new Date();
                        fromDate.setDate(toDate.getDate() - days);
                        const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                        
                        const url = `/api/historicalOR/indicesHistory?indexType=${encodeURIComponent(indexMap.nse)}&from=${fmt(fromDate)}&to=${fmt(toDate)}`;
                        const data = await this.request('GET', url, {
                            headers: { 'Referer': 'https://www.nseindia.com/reports-indices-historical-index-data' }
                        });
                        records = data?.data || [];
                    } catch (e) {
                        console.error(`[Sector] NSE Fallback failed for ${indexMap.internal}:`, e.message);
                    }
                }

                if (!Array.isArray(records)) continue;

                for (const row of records) {
                    const date = new Date(row.EOD_TIMESTAMP);
                    date.setUTCHours(12, 0, 0, 0);

                    await SectorIndex.findOneAndUpdate(
                        { indexName: indexMap.internal, date },
                        {
                            $set: {
                                indexName: indexMap.internal,
                                date,
                                open: parseFloat(row.EOD_OPEN_INDEX_VAL),
                                high: parseFloat(row.EOD_HIGH_INDEX_VAL),
                                low: parseFloat(row.EOD_LOW_INDEX_VAL),
                                close: parseFloat(row.EOD_CLOSE_INDEX_VAL),
                                volume: parseFloat(row.HIT_TURN_OVER) || 0,
                            }
                        },
                        { upsert: true }
                    );
                }
                console.log(`[Sector] Saved ${records.length} records for ${indexMap.internal}`);
            } catch (err) {
                console.error(`[Sector] Historical sync failed for ${indexMap.internal}: ${err.message}`);
            }
        }
    }
}

module.exports = SectorCollector;
