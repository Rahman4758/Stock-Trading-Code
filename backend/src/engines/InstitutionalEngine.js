const BaseEngine       = require('./BaseEngine');
const convictionService = require('../services/ConvictionService');
const technicalScorer  = require('../services/technicalScorer');


/**
 * InstitutionalEngine
 * Focuses on Smart Money accumulation and Technical Breakouts.
 * Strategy ID: CLASSIC_INSTITUTIONAL
 */
class InstitutionalEngine extends BaseEngine {
    constructor() {
        super('CLASSIC_INSTITUTIONAL', 'Classic Institutional Accumulation');
    }

    async analyze(snapshot) {
        if (!snapshot || !snapshot.priceHistory || snapshot.priceHistory.length < 30) {
            return null;
        }

        // 1. Calculate Institutional Accumulation via unified ConvictionService
        const instResult = await convictionService.compute(
            snapshot.symbol, 
            20, 
            snapshot.date, 
            snapshot.priceHistory
        );


        // 2. Calculate Technical Score (Trend, Breakout, Momentum)
        const techResult = await technicalScorer.computeTechnicalScore(
            snapshot.symbol, 
            null, // sectorIndex handled inside if needed, but we pass preFetched
            snapshot.date, 
            snapshot.priceHistory
        );

        // Only trigger if Institutional Score is at least "Moderate" (60+)
        if (instResult.compositeScore < 60) {
            return null;
        }

        const finalScore = Math.round((instResult.compositeScore * 0.6) + (techResult.technicalScore * 0.4));
        const grade = this.getGrade(finalScore);

        return {
            setupType: this.id,
            symbol: snapshot.symbol,
            date: snapshot.date,
            institutionalScore: instResult.compositeScore,
            technicalScore: techResult.technicalScore,
            finalScore,
            grade,
            components: instResult.scores,
            subScores: techResult.subScores,
            preTradeChecklist: techResult.checklist,
            checklistScore: techResult.checklistScore,
            flags: techResult.flags,
            levels: techResult.levels,
            action: this._getAction(grade),
        };
    }

    _getAction(grade) {
        const actions = {
            'A+': 'Institutional Conviction — High confidence entry at pivot',
            'A': 'Strong Accumulation — Standard entry on breakout',
            'B': 'Moderate Accumulation — Half position, wait for trend confirmation',
            'C': 'Watchlist — Institutional interest present but technicals lagging',
            'SKIP': 'Neutral — No clear institutional bias'
        };
        return actions[grade] || 'Monitor stock for institutional activity';
    }
}

module.exports = InstitutionalEngine;
