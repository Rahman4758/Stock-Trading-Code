const DailyPrice = require('../models/DailyPrice');
const OiData = require('../models/OiData');
const FiiDiiData = require('../models/FiiDiiData');
const BulkDeal = require('../models/BulkDeal');
const SectorIndex = require('../models/SectorIndex');

/**
 * MarketDataService (DAL - Data Access Layer)
 * 
 * Provides a unified, high-integrity "Source of Truth" for all market data.
 * All strategies should use this service instead of querying MongoDB directly.
 * Handles normalization, windowing, and lookback logic.
 */
class MarketDataService {
    /**
     * Get a complete data snapshot for a symbol on a specific date.
     * @param {string} symbol - Stock symbol
     * @param {Date} date - Reference date (12:00:00 UTC)
     * @param {Object} options - { priceDays: 60, flowDays: 20 }
     */
    async getSymbolSnapshot(symbol, date, options = { priceDays: 260, flowDays: 20 }) {
        symbol = symbol.toUpperCase();
        const refDate = new Date(date);
        refDate.setUTCHours(12, 0, 0, 0);

        const startDateFlow = new Date(refDate);
        startDateFlow.setDate(refDate.getDate() - options.flowDays);

        // 1. Fetch Price History (for technicals and delivery)
        const priceHistory = await DailyPrice.find({
            symbol,
            date: { $lte: refDate }
        }).sort({ date: -1 }).limit(options.priceDays).lean();

        if (!priceHistory || priceHistory.length === 0) return null;

        // 2. Fetch OI History
        const oiHistory = await OiData.find({
            symbol,
            date: { $gte: startDateFlow, $lte: refDate }
        }).sort({ date: -1 }).limit(10).lean();

        // 3. Fetch Institutional Flow (FII/DII)
        const flowData = await FiiDiiData.find({
            symbol,
            date: { $gte: startDateFlow, $lte: refDate }
        }).lean();

        // 4. Fetch Bulk Deals
        const bulkDeals = await BulkDeal.find({
            symbol,
            date: { $gte: startDateFlow, $lte: refDate }
        }).lean();

        return {
            symbol,
            date: refDate,
            latestPrice: priceHistory[0],
            priceHistory, // sorted date: -1
            oiHistory,
            flowData,
            bulkDeals
        };
    }

    /**
     * Get latest available trading date across the system.
     */
    async getLatestTradingDate() {
        const doc = await DailyPrice.findOne().sort({ date: -1 }).select('date').lean();
        return doc ? new Date(doc.date) : null;
    }

    /**
     * Get Nifty50 status
     */
    async getNiftyStatus(date) {
        const doc = await SectorIndex.findOne({ 
            indexName: 'NIFTY50', 
            date: { $lte: date } 
        }).sort({ date: -1 }).lean();
        return doc;
    }
}

module.exports = new MarketDataService();
