const SectorIndex = require('../models/SectorIndex');

class SectorRotationAnalyzer {
    /**
     * Get all active sectors and their rotation signals
     */
    async getSectorRankings() {
        // Fetch latest row for each sector
        const allIndices = await SectorIndex.aggregate([
            { $sort: { date: -1 } },
            {
                $group: {
                    _id: '$indexName',
                    latest: { $first: '$$ROOT' }
                }
            }
        ]);

        const sectors = allIndices
            .filter(idx => idx._id !== 'NIFTY50')
            .map(idx => ({
                indexName: idx._id,
                rsCurrent: idx.latest.rsVsNifty || 100,
                rsTrend: idx.latest.rsTrend || 'NEUTRAL',
                rotationSignal: idx.latest.rotationSignal || 'NEUTRAL',
                close: idx.latest.close,
            }));

        // Sort by RS
        sectors.sort((a, b) => b.rsCurrent - a.rsCurrent);

        return {
            leaders: sectors.filter(s => s.rotationSignal === 'ROTATING_IN' || s.rsCurrent > 100),
            laggards: sectors.filter(s => s.rotationSignal === 'ROTATING_OUT' || s.rsCurrent < 100),
            all: sectors,
        };
    }
}

module.exports = new SectorRotationAnalyzer();
