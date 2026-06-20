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

        // ── Compute components in parallel ─────────────────────────────
        const [fiiFlowVal, bulkDealBonus, oiScore, deliveryScore, hiddenScore] = await Promise.all([
            this._scoreFiiFlow(symbol, startDate, endDate), // Returns Market flow multiplier logic or null
            this._scoreBulkDeals(symbol, startDate, endDate), // Returns additive bonus points (-20 to +20)
            this._scoreOiSignal(symbol, startDate, endDate),  // Returns 0-100 or null if not F&O
            this._scoreDelivery(symbol, startDate, endDate, prefetchedPrices), // Returns 0-100
            this._scoreHiddenAccumulation(symbol, startDate, endDate, prefetchedPrices), // Returns 0-100
        ]);

        let coreScore = 0;
        let isFnO = oiScore !== null;

        if (isFnO) {
            coreScore = (deliveryScore * 0.50) + (oiScore * 0.30) + (hiddenScore * 0.20);
        } else {
            coreScore = (deliveryScore * 0.70) + (hiddenScore * 0.30);
        }

        let finalComposite = coreScore;

        // Apply Additive Bonus (Bulk Deals)
        if (bulkDealBonus !== 0) {
            finalComposite += bulkDealBonus;
        }

        // Apply Market Sentiment Multiplier (FII/DII)
        if (fiiFlowVal !== 1.0) {
            finalComposite = finalComposite * fiiFlowVal;
        }

        // Cap at 100 and floor at 0
        if (finalComposite > 100) finalComposite = 100;
        if (finalComposite < 0) finalComposite = 0;

        const compositeScore = parseFloat(finalComposite.toFixed(2));

        const result = {
            symbol,
            compositeScore,
            scores: {
                institutionalFlow:   parseFloat(fiiFlowVal.toFixed(2)),
                bulkDeal:            parseFloat(bulkDealBonus.toFixed(2)),
                oiSignal:            isFnO ? parseFloat(oiScore.toFixed(2)) : 50,
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
        if (!days.length) return 1.0; // No data -> neutral multiplier

        const netFlow = days.reduce((sum, d) => sum + d.fiiNet, 0);

        // Threshold: 50 Cr (stored as rupees: 1Cr = 10^7)
        const threshold = 500000000; // 50 Cr

        if (netFlow > threshold)  return 1.10; // +10% boost
        if (netFlow > 0)          return 1.05; // +5% boost
        if (netFlow < -threshold) return 0.90; // -10% drag
        if (netFlow < 0)          return 0.95; // -5% drag
        
        return 1.0;
    }

    async _scoreBulkDeals(symbol, startDate, endDate) {
        const [smartInstitutions, deals] = await Promise.all([
            Institution.find({ tier: { $lte: 2 } }).select('_id').lean(),
            snapshotRepo.getBulkDeals(symbol, startDate, endDate),
        ]);

        if (!deals.length) return 0.0; // Additive bonus is 0

        const smartIds = new Set(smartInstitutions.map(i => i._id.toString()));
        let buyVal = 0, sellVal = 0;

        deals.forEach(deal => {
            const multiplier = smartIds.has(deal.institutionId?.toString()) ? 2.0 : 1.0;
            if (deal.dealType === 'BUY')  buyVal  += (deal.dealValue || 0) * multiplier;
            if (deal.dealType === 'SELL') sellVal += (deal.dealValue || 0) * multiplier;
        });

        const net = buyVal - sellVal;
        const total = buyVal + sellVal;
        
        if (total === 0) return 0.0;

        // Ratio from -1 to +1
        const ratio = net / total;
        // Map ratio to -20 to +20 points bonus
        return ratio * 20.0;
    }

    async _scoreOiSignal(symbol, startDate, endDate) {
        const docs = await snapshotRepo.getOiRange(symbol, startDate, endDate);
        if (!docs.length) return null; // Important: Return null if no data so we know it's not F&O

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

        // Weight recent days heavier
        let totalWeight = 0, weightedSum = 0, weight = 1;
        [...validDocs].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(d => {
            weightedSum += d.deliveryPct * weight;
            totalWeight += weight;
            weight += 0.5; // recent days get progressively more weight
        });
        const avg = weightedSum / totalWeight;

        if (avg > 60) return 100.0;
        if (avg > 55) return 90.0;
        if (avg > 50) return 80.0;
        if (avg > 45) return 60.0;
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

        // Compare last 3 days against prior days to catch sudden explosions
        const recentDocs = docs.slice(-3);
        const priorDocs = docs.slice(0, -3);
        
        if (priorDocs.length === 0 || recentDocs.length === 0) return 50.0;

        const recentAvgVol = recentDocs.reduce((s,d) => s+(d.volume||0), 0) / recentDocs.length;
        const priorAvgVol = priorDocs.reduce((s,d) => s+(d.volume||0), 0) / priorDocs.length;
        
        const volChange = priorAvgVol === 0 ? 0 : (recentAvgVol - priorAvgVol) / priorAvgVol;
        
        const recentStartPrice = priorDocs[priorDocs.length-1].close;
        const recentEndPrice = recentDocs[recentDocs.length-1].close;
        const recentPriceChange = (recentEndPrice - recentStartPrice) / recentStartPrice;

        // Explosive Breakout: Volume more than doubled + Price up > 5%
        if (volChange > 1.0 && recentPriceChange >= 0.05) return 100.0;
        
        // Strong Momentum: Volume up 50% + Price up > 3%
        if (volChange > 0.5 && recentPriceChange >= 0.03) return 90.0;
        
        // Stealth Accumulation: Volume up 20% + Price flat
        if (volChange > 0.2 && recentPriceChange > -0.02 && recentPriceChange < 0.03) return 80.0;
        
        // Buying into Weakness: Volume up 50% + Price down sharply
        if (volChange > 0.5 && recentPriceChange <= -0.04) return 70.0;
        
        // Weak rally (distribution): Price up > 5% but volume dropped by 20%
        if (volChange < -0.2 && recentPriceChange > 0.05) return 30.0;

        // Selloff: Volume up + Price down
        if (volChange > 0.5 && recentPriceChange < -0.05) return 10.0;

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
