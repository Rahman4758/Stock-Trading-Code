/**
 * ConvictionService.js
 *
 * THE single canonical conviction score for any stock.
 * All consumers (scan, footprint, money-flow, portfolio) use THIS — nothing else.
 *
 * Replaces:
 *  - accumulationAnalyzer.js  (was used by footprint + ad-hoc scripts)
 *  - SnapshotBuilder.js conviction path (was used by scan pipeline)
 *
 * Weights (configurable via SystemConfig):
 *   FII Flow       30%  — stock-level net FII over window
 *   Bulk Deals     25%  — smart-money weighted buy/sell ratio
 *   OI Signal      20%  — futures OI signal over last 5 days
 *   Delivery %     15%  — avg delivery over window
 *   Hidden Accum   10%  — volume/price divergence pattern
 *
 * Result is stored in SmartMoneyScore collection and read by all API routes.
 */
const priceRepo    = require('../repositories/PriceRepository');
const fiiRepo      = require('../repositories/FiiRepository');
const snapshotRepo = require('../repositories/SnapshotRepository');
const Institution  = require('../models/Institution');

// Score bands for OI signals
const OI_SCORE_MAP = {
    LONG_BUILDUP:  100,
    SHORT_COVERING: 70,
    NEUTRAL:        50,
    LONG_UNWINDING: 30,
    SHORT_BUILDUP:   0,
};

class ConvictionService {
    /**
     * Compute and PERSIST the conviction score for a symbol.
     * Call this from the pipeline after data ingestion.
     *
     * @param {string}  symbol
     * @param {number}  [days=20]      - lookback window
     * @param {Date}    [refDate]      - reference date (default: today)
     * @param {Array}   [prefetchedPrices] - optional pre-loaded prices to avoid extra DB call
     * @returns {Promise<ConvictionResult>}
     */
    async compute(symbol, days = 20, refDate = null, prefetchedPrices = null, persist = true) {
        symbol = symbol.toUpperCase();
        const queryDate = refDate || new Date();

        // ── Anchor to latest available data date ─────────────────────────────
        let anchor;
        if (prefetchedPrices && prefetchedPrices.length > 0) {
            // prices are sorted date:-1, first is most recent
            anchor = prefetchedPrices[0];
        } else {
            anchor = await priceRepo.getLatest(symbol);
        }

        const endDate   = anchor ? new Date(anchor.date) : queryDate;
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        // ── Compute all 5 sub-scores in parallel ─────────────────────────────
        const [fiiScore, bulkScore, oiScore, deliveryScore, hiddenScore] = await Promise.all([
            this._scoreFiiFlow(symbol, startDate, endDate),
            this._scoreBulkDeals(symbol, startDate, endDate),
            this._scoreOiSignal(symbol, startDate, endDate),
            this._scoreDelivery(symbol, startDate, endDate, prefetchedPrices),
            this._scoreHiddenAccumulation(symbol, startDate, endDate, prefetchedPrices),
        ]);

        // ── Weighted composite ────────────────────────────────────────────────
        const compositeScore = parseFloat((
            fiiScore    * 0.30 +
            bulkScore   * 0.25 +
            oiScore     * 0.20 +
            deliveryScore * 0.15 +
            hiddenScore * 0.10
        ).toFixed(2));

        const result = {
            symbol,
            compositeScore,
            scores: {
                institutionalFlow:   parseFloat(fiiScore.toFixed(2)),
                bulkDeal:            parseFloat(bulkScore.toFixed(2)),
                oiSignal:            parseFloat(oiScore.toFixed(2)),
                delivery:            parseFloat(deliveryScore.toFixed(2)),
                hiddenAccumulation:  parseFloat(hiddenScore.toFixed(2)),
            },
            interpretation:  this._interpret(compositeScore),
            windowDays:      days,
            anchorDate:      endDate.toISOString().split('T')[0],
        };

        // ── Persist to SmartMoneyScore (Only if persist=true) ─────────────────
        if (persist) {
            const dateStr = endDate.toISOString().split('T')[0];
            await snapshotRepo.upsertScore(symbol, dateStr, {
                compositeScore,
                finalScore: compositeScore, // backward compat alias
                scores:     result.scores,
                interpretation: result.interpretation,
            });
        }

        return result;
    }

    /**
     * Read the latest persisted conviction score for a symbol.
     * Used by API routes — NO recomputation, just a fast DB read.
     * @param {string} symbol
     * @returns {Promise<Object|null>}
     */
    async getLatest(symbol) {
        return snapshotRepo.getLatestScore(symbol.toUpperCase());
    }

    /**
     * Get latest conviction scores for ALL stocks (served to scan page).
     * @returns {Promise<Array>}
     */
    async getAllLatest() {
        return snapshotRepo.getAllLatestScores();
    }

    // ── Private scoring methods (use Repositories, not models directly) ──────

    async _scoreFiiFlow(symbol, startDate, endDate) {
        // FiiRepository.getDailyFlow already handles duplicate-safe aggregation
        const days = await fiiRepo.getDailyFlow(symbol, startDate, endDate);
        if (!days.length) return 50.0; // No data → neutral

        const netFlow = days.reduce((sum, d) => sum + d.fiiNet, 0);

        // Threshold: 50 Cr (stored as rupees: 1Cr = 10^7)
        const threshold = 500000000; // 50 Cr

        if (netFlow > threshold)  return 100.0;
        if (netFlow < -threshold) return 0.0;
        return 50.0 + (netFlow / threshold) * 50.0;
    }

    async _scoreBulkDeals(symbol, startDate, endDate) {
        const [smartInstitutions, deals] = await Promise.all([
            Institution.find({ tier: { $lte: 2 } }).select('_id').lean(),
            snapshotRepo.getBulkDeals(symbol, startDate, endDate),
        ]);

        if (!deals.length) return 50.0;

        const smartIds = new Set(smartInstitutions.map(i => i._id.toString()));
        let buyVal = 0, sellVal = 0;

        deals.forEach(deal => {
            const multiplier = smartIds.has(deal.institutionId?.toString()) ? 2.0 : 1.0;
            if (deal.dealType === 'BUY')  buyVal  += (deal.dealValue || 0) * multiplier;
            if (deal.dealType === 'SELL') sellVal += (deal.dealValue || 0) * multiplier;
        });

        const total = buyVal + sellVal;
        return total === 0 ? 50.0 : (buyVal / total) * 100.0;
    }

    async _scoreOiSignal(symbol, startDate, endDate) {
        const docs = await snapshotRepo.getOiRange(symbol, startDate, endDate);
        if (!docs.length) return 50.0;

        // Weight recent days more (most recent gets highest weight)
        let weightedScore = 0, totalWeight = 0, weight = 1;
        [...docs].reverse().forEach(doc => {
            const s = OI_SCORE_MAP[doc.oiSignal || 'NEUTRAL'] ?? 50;
            weightedScore += s * weight;
            totalWeight   += weight;
            weight        += 0.5;
        });

        return totalWeight > 0 ? weightedScore / totalWeight : 50.0;
    }

    async _scoreDelivery(symbol, startDate, endDate, prefetchedPrices = null) {
        let docs;
        if (prefetchedPrices) {
            // Filter pre-fetched prices to window
            docs = prefetchedPrices.filter(p => {
                const d = new Date(p.date);
                return d >= startDate && d <= endDate;
            });
        } else {
            docs = await priceRepo.getRange(symbol, startDate, endDate);
        }

        if (!docs.length) return 50.0;

        const validDocs = docs.filter(d => (d.deliveryPct || 0) > 0);
        if (!validDocs.length) return 50.0;

        const avg = validDocs.reduce((sum, d) => sum + d.deliveryPct, 0) / validDocs.length;

        if (avg > 60) return 90.0;
        if (avg > 50) return 70.0;
        if (avg > 40) return 50.0;
        if (avg > 30) return 30.0;
        return 10.0;
    }

    async _scoreHiddenAccumulation(symbol, startDate, endDate, prefetchedPrices = null) {
        let docs;
        if (prefetchedPrices) {
            docs = prefetchedPrices
                .filter(p => { const d = new Date(p.date); return d >= startDate && d <= endDate; })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            docs = await priceRepo.getRange(symbol, startDate, endDate);
        }

        if (docs.length < 5) return 50.0;

        const first = docs[0];
        const last  = docs[docs.length - 1];
        if (!first.close || !last.close || !first.volume || !last.volume) return 50.0;

        const priceChange   = (last.close - first.close) / first.close;
        const half          = Math.floor(docs.length / 2);
        const avgVolFirst   = docs.slice(0, half).reduce((s, d) => s + (d.volume || 0), 0) / half;
        const avgVolSecond  = docs.slice(half).reduce((s, d) => s + (d.volume || 0), 0) / (docs.length - half);

        if (avgVolFirst === 0) return 50.0;
        const volChange = (avgVolSecond - avgVolFirst) / avgVolFirst;

        // Volume rising + price flat = stealth accumulation
        if (volChange > 0.2 && priceChange < 0.02 && priceChange > -0.05) return 90.0;
        // Volume rising + price falling = buying into weakness
        if (volChange > 0.3 && priceChange < -0.05)                        return 80.0;
        // Price up + volume falling = weak rally
        if (volChange < -0.2 && priceChange > 0.05)                        return 20.0;

        return 50.0;
    }

    _interpret(score) {
        if (score >= 75) return 'HEAVY ACCUMULATION — Strong institutional buying';
        if (score >= 60) return 'MODERATE ACCUMULATION — Steady institutional interest';
        if (score >= 40) return 'NEUTRAL — Mixed signals';
        if (score >= 25) return 'MODERATE DISTRIBUTION — Institutions selling';
        return 'HEAVY DISTRIBUTION — Strong institutional selling';
    }
}

module.exports = new ConvictionService();
