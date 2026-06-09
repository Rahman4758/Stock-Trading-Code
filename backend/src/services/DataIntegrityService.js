const SectorIndex = require('../models/SectorIndex');
const FiiDiiData = require('../models/FiiDiiData');
const SectorCollector = require('../collectors/SectorCollector');
const DataSourceManager = require('../collectors/dataSourceManager');

class DataIntegrityService {
    /**
     * Scan for data gaps in critical collections for the last N days
     * Returns gaps: { sectorIndices: Date[], fiiDii: Date[] }
     */
    static async checkGaps(days = 14) {
        console.log(`[Integrity] Auditing data for the last ${days} days...`);
        
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - days);
        fromDate.setHours(0, 0, 0, 0);

        // 1. Generate list of business days (M-F)
        const businessDays = [];
        let curr = new Date(fromDate);
        while (curr <= toDate) {
            const day = curr.getDay();
            if (day !== 0 && day !== 6) { // Not Sat/Sun
                businessDays.push(new Date(curr).toISOString().split('T')[0]);
            }
            curr.setDate(curr.getDate() + 1);
        }

        // 2. Fetch existing records
        const [indices, fiiDii] = await Promise.all([
            SectorIndex.find({ 
                indexName: 'NIFTY50', 
                date: { $gte: fromDate } 
            }).lean(),
            FiiDiiData.find({ 
                date: { $gte: fromDate } 
            }).lean()
        ]);

        const existingIndices = new Set(indices.map(i => i.date.toISOString().split('T')[0]));
        const existingFiiDii = new Set(fiiDii.map(f => f.date.toISOString().split('T')[0]));

        // 3. Find missing days
        const missingIndices = businessDays.filter(d => !existingIndices.has(d));
        const missingFiiDii = businessDays.filter(d => !existingFiiDii.has(d));

        return {
            missingIndices,
            missingFiiDii,
            hasGaps: missingIndices.length > 0 || missingFiiDii.length > 0
        };
    }

    /**
     * Attempt to automatically heal any detected gaps
     */
    static async autoHeal(gaps) {
        if (!gaps.hasGaps) {
            console.log('[Integrity] System healthy. 100% data coverage confirmed.');
            return { healed: true };
        }

        console.log(`[Integrity] Gaps detected! Healing ${gaps.missingIndices.length} index gaps and ${gaps.missingFiiDii.length} FII/DII gaps...`);

        try {
            // Determine range needed (max days back)
            const allMissing = [...gaps.missingIndices, ...gaps.missingFiiDii];
            const dates = allMissing.map(d => new Date(d));
            const oldest = new Date(Math.min(...dates));
            const daysBack = Math.ceil((new Date() - oldest) / (1000 * 60 * 60 * 24)) + 1;

            console.log(`[Integrity] Triggering retrospective sync for the last ${daysBack} days...`);

            // 1. Heal Indices
            const sectorCollector = new SectorCollector();
            await sectorCollector.syncHistory(daysBack);

            // 2. Heal FII/DII
            const dsm = new DataSourceManager();
            await dsm.collectFiiDii({ days: daysBack });

            console.log('[Integrity] Healing process complete.');
            return { healed: true };
        } catch (err) {
            console.error('[Integrity] Auto-healing failed:', err.message);
            return { healed: false, error: err.message };
        }
    }
}

module.exports = DataIntegrityService;
