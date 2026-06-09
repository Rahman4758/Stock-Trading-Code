/**
 * accumulationAnalyzer.js
 *
 * Thin wrapper around ConvictionService for backward compatibility.
 * New code should import ConvictionService directly.
 *
 * @deprecated - Use ConvictionService.compute() instead.
 */
const convictionService = require('./ConvictionService');

class AccumulationAnalyzer {
    /**
     * @deprecated Use ConvictionService.compute() instead.
     */
    async calculateAccumulationScore(symbol, days = 20, referenceDate = null, preFetchedPrices = null) {
        return convictionService.compute(symbol, days, referenceDate, preFetchedPrices);
    }
}

module.exports = new AccumulationAnalyzer();
