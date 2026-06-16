const BaseEngine = require('./BaseEngine');
const compressionReleaseStrategy = require('../strategies/compressionReleaseStrategy');

/**
 * TrendEngine
 * Focuses on Trend Continuation and Momentum Breakouts (Compression-Release).
 * Strategy ID: COMPRESSION_RELEASE
 */
class TrendEngine extends BaseEngine {
    constructor() {
        super('COMPRESSION_RELEASE', 'Trend Compression-Release');
    }

    async analyze(snapshot) {
        if (!snapshot || !snapshot.priceHistory || snapshot.priceHistory.length < 50) {
            return {
                setupType: this.id,
                symbol: snapshot?.symbol || 'UNKNOWN',
                date: snapshot?.date || new Date(),
                grade: 'SKIP',
                action: 'INCOMPLETE DATA',
                flags: [`Missing History: Needs 50 days, has ${snapshot?.priceHistory?.length || 0}`],
                compositeScore: 0,
                finalScore: 0
            };
        }

        const result = await compressionReleaseStrategy.analyze(
            snapshot.symbol, 
            null, 
            snapshot.date, 
            snapshot.priceHistory
        );

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

module.exports = TrendEngine;
