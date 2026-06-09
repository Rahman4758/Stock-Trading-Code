
const SectorPerformance = require('../models/SectorPerformance');
const SectorIndex = require('../models/SectorIndex');

class SectorRotationSystem {
    /**
     * Calculate and save normalized performance for all sectors across all timeframes
     */
    async updateAllTimeframes() {
        console.log('[SectorRotationSystem] Updating macro trend data...');
        const timeframes = {
            '1W': 5,
            '1M': 22,
            '3M': 66,
            '6M': 132
        };

        const sectorIds = [
            'NIFTY_IT', 'NIFTY_BANK', 'NIFTY_AUTO', 'NIFTY_PHARMA', 
            'NIFTY_FMCG', 'NIFTY_METAL', 'NIFTY_REALTY', 'NIFTY_ENERGY'
        ];

        // Map NIFTY_ symbols to UI short IDs
        const idMap = {
            'NIFTY_IT': 'IT',
            'NIFTY_BANK': 'BANK',
            'NIFTY_AUTO': 'AUTO',
            'NIFTY_PHARMA': 'PHARMA',
            'NIFTY_FMCG': 'FMCG',
            'NIFTY_METAL': 'METAL',
            'NIFTY_REALTY': 'REALTY',
            'NIFTY_ENERGY': 'ENERGY'
        };

        for (const [tf, days] of Object.entries(timeframes)) {
            console.log(`[SectorRadar] Processing timeframe: ${tf} (${days} days)`);
            for (const sectorName of sectorIds) {
                try {
                    const history = await SectorIndex.find({ indexName: sectorName })
                        .sort({ date: -1 })
                        .limit(days)
                        .lean();

                    if (history.length < 2) continue;

                    // Chronological order
                    const data = history.reverse();
                    const basePrice = data[0].close;
                    const normalizedPoints = data.map(point => ({
                        date: point.date,
                        value: (point.close / basePrice) * 100
                    }));
                    const totalChange = ((data[data.length - 1].close - basePrice) / basePrice) * 100;

                    await SectorPerformance.findOneAndUpdate(
                        { timeframe: tf, sector_id: idMap[sectorName] },
                        {
                            $set: {
                                timeframe: tf,
                                sector_id: idMap[sectorName],
                                data_points: normalizedPoints,
                                total_change: totalChange,
                                date_range: {
                                    from: data[0].date,
                                    to: data[data.length - 1].date
                                },
                                generated_at: new Date()
                            }
                        },
                        { upsert: true }
                    );
                } catch (err) {
                    console.error(`[SectorRadar] Failed for ${sectorName} on ${tf}:`, err.message);
                }
            }
        }
        console.log('[SectorRadar] Performance update complete.');
    }
}

module.exports = new SectorRotationSystem();