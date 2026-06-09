const DailyPrice = require('../models/DailyPrice');
const SectorIndex = require('../models/SectorIndex');

class RelativeStrengthAnalyzer {
    /**
     * Calculate Relative Strength of a stock vs Nifty50 and its Sector
     * RS = (Stock Return / Benchmark Return) * 100 + 100
     * @param {string} symbol - Stock symbol
     * @param {string} sectorIndexName - Nifty sector index name
     * @param {number} period - Days to look back (default 60)
     */
    async calculateRelativeStrength(symbol, sectorIndexName, period = 60) {
        // Find date ranges
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - period);

        // Fetch stock prices
        const priceDocs = await DailyPrice.find({
            symbol: symbol.toUpperCase(),
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();

        if (priceDocs.length < 5) return this._defaultResponse();

        const stockEnd = priceDocs[priceDocs.length - 1].close;
        const stockStart = priceDocs[0].close;
        const stockReturn = (stockEnd - stockStart) / stockStart;

        // Fetch Nifty50
        const niftyDocs = await SectorIndex.find({
            indexName: 'NIFTY50',
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();

        let rsNifty = 100;
        if (niftyDocs.length > 0) {
            const nEnd = niftyDocs[niftyDocs.length - 1].close;
            const nStart = niftyDocs[0].close;
            const nReturn = (nEnd - nStart) / nStart;
            rsNifty = 100 + ((stockReturn - nReturn) * 100);
        }

        // Fetch Sector
        let rsSector = 100;
        if (sectorIndexName) {
            const sectorDocs = await SectorIndex.find({
                indexName: sectorIndexName.toUpperCase(),
                date: { $gte: startDate, $lte: endDate }
            }).sort({ date: 1 }).lean();

            if (sectorDocs.length > 0) {
                const sEnd = sectorDocs[sectorDocs.length - 1].close;
                const sStart = sectorDocs[0].close;
                const sReturn = (sEnd - sStart) / sStart;
                rsSector = 100 + ((stockReturn - sReturn) * 100);
            }
        }

        // Build 10-day momentum
        const hist10Date = new Date();
        hist10Date.setDate(hist10Date.getDate() - 10);
        const p10 = priceDocs.find(d => d.date >= hist10Date)?.close || stockStart;
        const n10 = niftyDocs.find(d => d.date >= hist10Date)?.close || (niftyDocs[0]?.close || 1);
        const stRet10 = (stockEnd - p10) / p10;
        const nRet10 = (niftyDocs[niftyDocs.length - 1]?.close - n10) / n10;

        const rs10 = 100 + ((stRet10 - nRet10) * 100);
        const trend = rs10 > rsNifty ? 'STRENGTHENING' : rs10 < rsNifty ? 'WEAKENING' : 'NEUTRAL';

        return {
            rsVsMarket: parseFloat(rsNifty.toFixed(2)),
            rsVsSector: parseFloat(rsSector.toFixed(2)),
            rsTrend: trend,
            rsScore: parseFloat((rsNifty > 100 ? Math.min(100, rsNifty - 50) : Math.max(0, rsNifty - 50)).toFixed(2)), // 0-100 score format
            interpretation: this._interpret(rsNifty, trend),
        };
    }

    _defaultResponse() {
        return {
            rsVsMarket: 100,
            rsVsSector: 100,
            rsTrend: 'NEUTRAL',
            rsScore: 50,
            interpretation: 'NEUTRAL - In line with market',
        };
    }

    _interpret(rs, trend) {
        if (rs > 105 && trend === 'STRENGTHENING') return "STRONG LEADER - Outperforming and strengthening";
        if (rs > 100 && trend !== 'WEAKENING') return "LEADER - Outperforming market";
        if (rs > 100 && trend === 'WEAKENING') return "WEAKENING LEADER - Losing momentum";
        if (rs < 95 && trend === 'WEAKENING') return "WEAK - Underperforming and deteriorating";
        return "NEUTRAL - In line with market";
    }
}

module.exports = new RelativeStrengthAnalyzer();
