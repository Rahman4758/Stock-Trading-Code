/**
 * ConvictionEngine.js
 * Implements the 5-layer weighted algorithm to calculate institutional conviction.
 */

class ConvictionEngine {
    
    /**
     * Calculates the conviction score components based on the 15-day average metrics.
     * 
     * @param {Object} metrics - The aggregated metrics for the stock
     * @param {number} metrics.avg_fii_net - 15-day average FII Net Flow
     * @param {number} metrics.avg_dii_net - 15-day average DII Net Flow
     * @param {number} metrics.pcr - Latest or average Put-Call Ratio
     * @param {number} metrics.del_pct - 15-day average Delivery Percentage
     * @param {number} metrics.rev_growth - Quarterly revenue growth proxy
     * @returns {Object} detailed score breakdown and total score
     */
    static calculateConviction(metrics, configWeights = null) {
        const { avg_fii_net = 0, avg_dii_net = 0, pcr = 1.0, del_pct = 0, rev_growth = 0 } = metrics;
        
        // Use provided weights or fallback to defaults
        const w = configWeights || {
            fii_score_max: 25,
            dii_score_max: 20,
            pcr_score_max: 20,
            deliv_score_max: 15,
            fundamental_score_max: 10
        };

        // FII Component: score = min(fii_score_max, max(0, (avg_fii_net / 1000) * 12 + 13))
        // Standard formula normalized to new max
        const fii_score = Math.min(w.fii_score_max, Math.max(0, (avg_fii_net / 1000) * (w.fii_score_max * 0.48) + (w.fii_score_max * 0.52)));

        // DII Component: score = min(dii_score_max, max(0, (avg_dii_net / 800) * 10 + 10))
        const dii_score = Math.min(w.dii_score_max, Math.max(0, (avg_dii_net / 800) * (w.dii_score_max * 0.5) + (w.dii_score_max * 0.5)));

        // PCR Component (Scale based on max)
        let pcr_score = w.pcr_score_max * 0.25;
        if (pcr >= 1.2) pcr_score = w.pcr_score_max;
        else if (pcr >= 0.9) pcr_score = w.pcr_score_max * 0.6;

        // Delivery Component (Scale based on max)
        let deliv_score = w.deliv_score_max * 0.25;
        if (del_pct >= 60) deliv_score = w.deliv_score_max;
        else if (del_pct >= 50) deliv_score = w.deliv_score_max * 0.6;

        // Fundamental (Scale based on max)
        let fundamental_score = w.fundamental_score_max * 0.2;
        if (rev_growth >= 5) fundamental_score = w.fundamental_score_max;
        else if (rev_growth >= 0) fundamental_score = w.fundamental_score_max * 0.6;

        // Conviction Score = sum of all components (capped at 100)
        let total_score = fii_score + dii_score + pcr_score + deliv_score + fundamental_score;
        total_score = Math.min(100, Math.max(0, total_score)); // Cap between 0 and 100

        // Determine Signal Badges
        let signal = "AVOID";
        if (total_score >= 80) signal = "STRONG BUY";
        else if (total_score >= 70) signal = "BUY";
        else if (total_score >= 60) signal = "PREPARE";
        else if (total_score >= 50) signal = "WATCH";

        // Determine Institutional Bias purely for Daily Snapshot
        let institutional_bias = "neutral";
        if ((avg_fii_net + avg_dii_net) > 500) institutional_bias = "bullish";
        else if ((avg_fii_net + avg_dii_net) < -300) institutional_bias = "bearish";

        return {
            fii_score: parseFloat(fii_score.toFixed(2)),
            dii_score: parseFloat(dii_score.toFixed(2)),
            pcr_score,
            deliv_score,
            fundamental_score,
            total_score: parseFloat(total_score.toFixed(2)),
            signal,
            institutional_bias
        };
    }
}

module.exports = ConvictionEngine;
