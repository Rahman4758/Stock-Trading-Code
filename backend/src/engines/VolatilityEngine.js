const BaseEngine = require('./BaseEngine');
const nr7Strategy = require('../strategies/nr7Strategy');

/**
 * VolatilityEngine
 * Focuses on Range Contraction and Breakout setups (NR7, NR4).
 * Strategy ID: NR7_COMPRESSION
 */
class VolatilityEngine extends BaseEngine {
    constructor() {
        super('NR7_COMPRESSION', 'NR7 Volatility Compression');
    }

    async analyze(snapshot) {
        if (!snapshot || !snapshot.priceHistory || snapshot.priceHistory.length < 100) {
            return {
                setupType: this.id,
                symbol: snapshot?.symbol || 'UNKNOWN',
                date: snapshot?.date || new Date(),
                grade: 'SKIP',
                action: 'INCOMPLETE DATA',
                flags: [`Missing History: Needs 100 days, has ${snapshot?.priceHistory?.length || 0}`],
                compositeScore: 0,
                finalScore: 0
            };
        }

        // Call existing strategy but with the clean snapshot
        const result = await nr7Strategy.analyze(
            snapshot.symbol, 
            null, 
            snapshot.date, 
            snapshot.priceHistory
        );

        // If the strategy doesn't find a valid setup, we return null
        if (!result || !result.isSetup) {
            return null;
        }

        return {
            ...result,
            setupType: this.id,
            date: snapshot.date,
        };
    }
}

module.exports = VolatilityEngine;
