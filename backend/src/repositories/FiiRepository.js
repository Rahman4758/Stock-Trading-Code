/**
 * FiiRepository.js
 *
 * Single source of truth for ALL FiiDiiData DB queries.
 * Handles the critical per-day deduplication aggregation so no consumer
 * ever accidentally sums duplicate records again.
 */
const FiiDiiData = require('../models/FiiDiiData');

class FiiRepository {
    /**
     * Get per-day FII/DII flow for a symbol over a date range.
     * Uses $avg aggregation per calendar day — immune to timestamp duplicates.
     * @param {string} symbol
     * @param {Date}   startDate
     * @param {Date}   endDate
     * @returns {Promise<Array<{date, fiiNet, diiNet, combinedNet}>>}
     */
    async getDailyFlow(symbol, startDate, endDate) {
        const pipeline = [
            { $match: { symbol, date: { $gte: startDate, $lte: endDate } } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                fiiNet:       { $avg: '$fiiNet' },
                diiNet:       { $avg: '$diiNet' },
                fiiGrossBuy:  { $avg: '$fiiGrossBuy' },
                fiiGrossSell: { $avg: '$fiiGrossSell' },
                diiGrossBuy:  { $avg: '$diiGrossBuy' },
                diiGrossSell: { $avg: '$diiGrossSell' },
            }},
            { $sort: { _id: 1 } },
        ];
        const rows = await FiiDiiData.aggregate(pipeline);
        return rows.map(r => ({
            date:         r._id,
            fiiNet:       r.fiiNet   || 0,
            diiNet:       r.diiNet   || 0,
            combinedNet:  (r.fiiNet || 0) + (r.diiNet || 0),
            fiiGrossBuy:  r.fiiGrossBuy  || 0,
            fiiGrossSell: r.fiiGrossSell || 0,
            diiGrossBuy:  r.diiGrossBuy  || 0,
            diiGrossSell: r.diiGrossSell || 0,
        }));
    }

    /**
     * Get net FII flow sum for a symbol over a window (used for scoring).
     * Safe against duplicate records via $avg-per-day then sum-across-days.
     * @param {string} symbol
     * @param {number} [days=20]
     * @param {Date}   [upToDate]
     * @returns {Promise<number>} total fiiNet in rupees
     */
    async getNetFlow(symbol, days = 20, upToDate = null) {
        const end   = upToDate ? new Date(upToDate) : new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        const rows  = await this.getDailyFlow(symbol, start, end);
        return rows.reduce((sum, r) => sum + r.fiiNet, 0);
    }

    /**
     * Get market-wide (TOTAL_MARKET) FII/DII summary for the last N days.
     * @param {number} [days=30]
     * @returns {Promise<Array>}
     */
    async getMarketFlow(days = 30) {
        const end   = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        return this.getDailyFlow('TOTAL_MARKET', start, end);
    }

    /**
     * Get today's TOTAL_MARKET FII/DII record.
     * @returns {Promise<{fiiNet, diiNet, combinedNet}|null>}
     */
    async getMarketFlowToday() {
        const end   = new Date();
        const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000); // last 2 days
        const rows  = await this.getMarketFlow(2);
        return rows.length ? rows[rows.length - 1] : null;
    }

    /**
     * Upsert a FII/DII record (normalized to UTC midday to prevent duplicates).
     * @param {string} symbol
     * @param {string} dateStr - YYYY-MM-DD
     * @param {Object} data
     */
    async upsert(symbol, dateStr, data) {
        const date = new Date(dateStr + 'T12:00:00.000Z');
        return FiiDiiData.findOneAndUpdate(
            { symbol, date },
            { $set: { ...data, symbol, date } },
            { upsert: true, new: true }
        );
    }

    /**
     * Remove duplicate records for a symbol+date, keeping the most recent.
     * Called after any batch import to ensure clean state.
     * @param {string} symbol
     * @param {string} dateStr - YYYY-MM-DD
     */
    async deduplicateDay(symbol, dateStr) {
        const start = new Date(dateStr + 'T00:00:00.000Z');
        const end   = new Date(dateStr + 'T23:59:59.999Z');
        const docs  = await FiiDiiData
            .find({ symbol, date: { $gte: start, $lte: end } })
            .sort({ _id: -1 }) // newest first
            .lean();

        if (docs.length <= 1) return;
        const toDelete = docs.slice(1).map(d => d._id);
        await FiiDiiData.deleteMany({ _id: { $in: toDelete } });
    }
}

module.exports = new FiiRepository();
