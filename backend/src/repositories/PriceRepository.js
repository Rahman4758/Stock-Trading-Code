/**
 * PriceRepository.js
 *
 * Single source of truth for ALL DailyPrice DB queries.
 * No other file should import DailyPrice directly — import this instead.
 *
 * Benefits:
 *  - Query logic in one place → fix once, fixed everywhere
 *  - Easy to add Redis caching layer later without touching consumers
 *  - Testable in isolation
 */
const DailyPrice = require('../models/DailyPrice');
const marketCalendar = require('../services/MarketCalendar');

class PriceRepository {
    /**
     * Get the latest N days of price history for a symbol.
     * Sorted ascending (oldest first) — ready for technical indicator libraries.
     * @param {string} symbol
     * @param {number} [limit=260] - number of records
     * @param {Date}   [upToDate]  - optional ceiling date (defaults to today)
     * @returns {Promise<Array>}
     */
    async getHistory(symbol, limit = 260, upToDate = null) {
        const query = { symbol: symbol.toUpperCase() };
        if (upToDate) query.date = { $lte: upToDate };

        const docs = await DailyPrice
            .find(query)
            .sort({ date: -1 })
            .limit(limit)
            .lean();

        return docs.reverse(); // ascending for TA libraries
    }

    /**
     * Get the single latest price record for a symbol.
     * @param {string} symbol
     * @returns {Promise<Object|null>}
     */
    async getLatest(symbol) {
        return DailyPrice
            .findOne({ symbol: symbol.toUpperCase() })
            .sort({ date: -1 })
            .lean();
    }

    /**
     * Get price records for a symbol within a date range.
     * Sorted ascending.
     * @param {string} symbol
     * @param {Date}   startDate
     * @param {Date}   endDate
     * @returns {Promise<Array>}
     */
    async getRange(symbol, startDate, endDate) {
        return DailyPrice
            .find({
                symbol: symbol.toUpperCase(),
                date: { $gte: startDate, $lte: endDate }
            })
            .sort({ date: 1 })
            .lean();
    }

    /**
     * Get a specific day's price record (normalized to UTC midday).
     * @param {string} symbol
     * @param {Date|string} date
     * @returns {Promise<Object|null>}
     */
    async getForDate(symbol, date) {
        const d = typeof date === 'string' ? new Date(date + 'T12:00:00.000Z') : new Date(date);
        d.setUTCHours(12, 0, 0, 0);
        return DailyPrice.findOne({ symbol: symbol.toUpperCase(), date: d }).lean();
    }

    /**
     * Get the latest N records for a symbol before a given date.
     * Sorted descending (newest first).
     * @param {string} symbol
     * @param {Date}   beforeDate
     * @param {number} [limit=15]
     * @returns {Promise<Array>}
     */
    async getHistoryBefore(symbol, beforeDate, limit = 15) {
        return DailyPrice
            .find({ symbol: symbol.toUpperCase(), date: { $lt: beforeDate } })
            .sort({ date: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get the most recent date for which we have price data (any symbol).
     * Used by sync status to determine data freshness.
     * @returns {Promise<string|null>} YYYY-MM-DD or null
     */
    async getLatestDataDate() {
        const doc = await DailyPrice.findOne().sort({ date: -1 }).select('date').lean();
        return doc ? marketCalendar._toIST(new Date(doc.date)) : null;
    }

    /**
     * Upsert a daily price record (normalized to UTC midday).
     * @param {string} symbol
     * @param {string} dateStr - YYYY-MM-DD
     * @param {Object} data    - price fields
     * @returns {Promise<Object>}
     */
    async upsert(symbol, dateStr, data) {
        const date = new Date(dateStr + 'T12:00:00.000Z');
        return DailyPrice.findOneAndUpdate(
            { symbol: symbol.toUpperCase(), date },
            { $set: { ...data, symbol: symbol.toUpperCase(), date } },
            { upsert: true, new: true }
        );
    }

    /**
     * Compute average volume over last N days before a given date.
     * @param {string} symbol
     * @param {Date}   beforeDate
     * @param {number} [days=20]
     * @returns {Promise<number>}
     */
    async getAvgVolume(symbol, beforeDate, days = 20) {
        const history = await this.getHistoryBefore(symbol, beforeDate, days);
        if (!history.length) return 0;
        return history.reduce((sum, p) => sum + (p.volume || 0), 0) / history.length;
    }
}

module.exports = new PriceRepository();
