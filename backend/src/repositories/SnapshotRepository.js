/**
 * SnapshotRepository.js
 *
 * Single source of truth for SmartMoneyScore, DailySnapshot, OiData, BulkDeal queries.
 */
const SmartMoneyScore = require('../models/SmartMoneyScore');
const DailySnapshot   = require('../models/DailySnapshot');
const OiData          = require('../models/OiData');
const BulkDeal        = require('../models/BulkDeal');

class SnapshotRepository {

    // ── SmartMoneyScore ────────────────────────────────────────────────────────

    /**
     * Get the latest SmartMoneyScore for a symbol.
     * @param {string} symbol
     * @returns {Promise<Object|null>}
     */
    async getLatestScore(symbol) {
        return SmartMoneyScore
            .findOne({ symbol: symbol.toUpperCase() })
            .sort({ date: -1 })
            .lean();
    }

    /**
     * Get SmartMoneyScore for all active stocks for the latest date.
     * Used by scan route to serve pre-computed results.
     * @returns {Promise<Array>}
     */
    async getAllLatestScores() {
        // Find the most recent date that has scores
        const latest = await SmartMoneyScore.findOne().sort({ date: -1 }).select('date').lean();
        if (!latest) return [];

        const latestDate = new Date(latest.date);
        const startOfDay = new Date(latestDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(latestDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        return SmartMoneyScore
            .find({ date: { $gte: startOfDay, $lte: endOfDay } })
            .sort({ compositeScore: -1 })
            .lean();
    }

    /**
     * Upsert a SmartMoneyScore (normalized to UTC midday).
     * @param {string} symbol
     * @param {string} dateStr  YYYY-MM-DD
     * @param {Object} scoreData
     */
    async upsertScore(symbol, dateStr, scoreData) {
        const date = new Date(dateStr + 'T12:00:00.000Z');
        return SmartMoneyScore.findOneAndUpdate(
            { symbol: symbol.toUpperCase(), date },
            { $set: { ...scoreData, symbol: symbol.toUpperCase(), date } },
            { upsert: true, new: true }
        );
    }

    // ── DailySnapshot ──────────────────────────────────────────────────────────

    /**
     * Get the latest DailySnapshot for a symbol.
     * @param {string} symbol
     * @returns {Promise<Object|null>}
     */
    async getLatestSnapshot(symbol) {
        return DailySnapshot
            .findOne({ symbol: symbol.toUpperCase() })
            .sort({ date: -1 })
            .lean();
    }

    // ── OiData ─────────────────────────────────────────────────────────────────

    /**
     * Get OI records for a symbol in a date range.
     * @param {string} symbol
     * @param {Date}   startDate
     * @param {Date}   endDate
     * @returns {Promise<Array>}
     */
    async getOiRange(symbol, startDate, endDate) {
        return OiData
            .find({ symbol: symbol.toUpperCase(), date: { $gte: startDate, $lte: endDate } })
            .sort({ date: 1 })
            .lean();
    }

    /**
     * Get the latest OI record for a symbol.
     * @param {string} symbol
     * @returns {Promise<Object|null>}
     */
    async getLatestOi(symbol) {
        return OiData
            .findOne({ symbol: symbol.toUpperCase() })
            .sort({ date: -1 })
            .lean();
    }

    /**
     * Get the latest 2 OI records for a symbol — used for PCR relative shift calculation.
     * [0] = today, [1] = yesterday
     * @param {string} symbol
     * @returns {Promise<Array>}
     */
    async getLatestTwoOi(symbol) {
        return OiData
            .find({ symbol: symbol.toUpperCase() })
            .sort({ date: -1 })
            .limit(2)
            .lean();
    }

    // ── BulkDeal ───────────────────────────────────────────────────────────────

    /**
     * Get bulk/block deals for a symbol in a date range.
     * @param {string} symbol
     * @param {Date}   startDate
     * @param {Date}   endDate
     * @returns {Promise<Array>}
     */
    async getBulkDeals(symbol, startDate, endDate) {
        return BulkDeal
            .find({ symbol: symbol.toUpperCase(), date: { $gte: startDate, $lte: endDate } })
            .sort({ date: 1 })
            .lean();
    }
}

module.exports = new SnapshotRepository();
