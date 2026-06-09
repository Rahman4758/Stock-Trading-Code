/**
 * BaseEngine
 * Common interface for all strategy engines.
 */
class BaseEngine {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }

    /**
     * @param {Object} snapshot - Data from MarketDataService
     * @returns {Promise<Object|null>} - Analysis result or null if no signal
     */
    async analyze(snapshot) {
        throw new Error('Analyze method must be implemented');
    }

    /**
     * Helper to get grade based on score
     */
    getGrade(score) {
        if (score >= 85) return 'A+';
        if (score >= 75) return 'A';
        if (score >= 65) return 'B';
        if (score >= 50) return 'C';
        return 'SKIP';
    }
}

module.exports = BaseEngine;
