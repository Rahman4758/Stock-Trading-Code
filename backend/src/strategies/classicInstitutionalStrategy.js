const accumulationAnalyzer = require('../services/accumulationAnalyzer');
const technicalScorer = require('../services/technicalScorer');

/**
 * Strategy: Classic Institutional Accumulation
 * Focuses on high-conviction institutional buying (FII/DII) combined with technical trend alignment.
 */
class ClassicInstitutionalStrategy {
    constructor() {
        this.name = 'CLASSIC_INSTITUTIONAL';
    }

    async analyze(symbol, sectorIndex, referenceDate, priceHistory) {
        // 1. Calculate Institutional Accumulation Score (0-100)
        const smartMoney = await accumulationAnalyzer.calculateAccumulationScore(symbol, 20, referenceDate, priceHistory);
        const institutionalScore = smartMoney.compositeScore;

        // If institutional conviction is low, this strategy doesn't trigger
        if (institutionalScore < 55) return null;

        // 2. Calculate Technical Score (0-100)
        const techData = await technicalScorer.computeTechnicalScore(symbol, sectorIndex, referenceDate, priceHistory);
        
        // 3. Compute Final Weighted Score
        // Weight: 60% Institutional, 40% Technical
        let finalScore = (institutionalScore * 0.60) + (techData.technicalScore * 0.40);

        // Blocking Flags (Moved from main selector to strategy-specific logic)
        // We only "SKIP" if both are extremely poor, or if trend is completely broken
        if (techData.flags.includes('TREND_FAIL') && institutionalScore < 70) {
            // If trend failed and inst flow is also just moderate, skip
            return { grade: 'SKIP', finalScore: 0, setupType: this.name };
        }

        const gradeMapping = this._getGrade(finalScore);

        return {
            symbol,
            targetDate: referenceDate,
            institutionalScore,
            technicalScore: techData.technicalScore,
            finalScore: parseFloat(finalScore.toFixed(2)),
            grade: gradeMapping.grade,
            action: gradeMapping.action,
            flags: techData.flags,
            preTradeChecklist: techData.checklist,
            checklistScore: techData.checklistScore,
            subScores: techData.subScores,
            levels: techData.levels,
            setupType: this.name,
            components: smartMoney.scores
        };
    }

    _getGrade(finalScore) {
        if (finalScore >= 85) return { grade: 'A+', action: 'Full position — aggressive entry at pivot breakout' };
        if (finalScore >= 75) return { grade: 'A', action: 'Standard position — enter at breakout confirmation' };
        if (finalScore >= 65) return { grade: 'B', action: 'Half position — add second half on next confirmation candle' };
        if (finalScore >= 55) return { grade: 'C', action: 'Watchlist only — wait for technical improvement' };
        return { grade: 'SKIP', action: 'Do not trade — insufficient confluence' };
    }
}

module.exports = new ClassicInstitutionalStrategy();
