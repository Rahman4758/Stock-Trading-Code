const SaaSignal = require('../models/SaaSignal');

class SaaEngine {
    /**
     * Get active risk signals for a specific sector or all sectors
     */
    async getStatusForSector(sectorId) {
        const signals = await SaaSignal.find({ 
            isActive: true, 
            affectedSectors: sectorId 
        }).sort({ detectedAt: -1 }).lean();

        if (signals.length === 0) {
            return {
                status: 'CLEAR',
                message: 'No active macro risks detected. Normal trading permitted.'
            };
        }

        // Return highest severity signal
        const primary = signals[0];
        return {
            status: primary.status,
            message: primary.message,
            severity: primary.severity,
            event: primary.eventType
        };
    }

    /**
     * Get a map of all sector statuses
     */
    async getAllSectorStatuses() {
        const activeSignals = await SaaSignal.find({ isActive: true }).sort({ detectedAt: -1 }).lean();
        
        const sectorMap = {};
        const sectors = ['IT', 'BANK', 'AUTO', 'PHARMA', 'FMCG', 'METAL', 'REALTY', 'ENERGY'];
        
        sectors.forEach(s => {
            const relevant = activeSignals.find(sig => sig.affectedSectors.includes(s));
            if (relevant) {
                sectorMap[s] = {
                    status: relevant.status,
                    reason: relevant.message
                };
            } else {
                sectorMap[s] = {
                    status: 'CLEAR',
                    reason: ''
                };
            }
        });

        return {
            updated_at: new Date(),
            sectors: sectorMap
        };
    }

    /**
     * Internal: Generate a signal based on macro news or rules
     * (In a real system, this would be fed by an AI agent reading news)
     */
    async injectSignal(data) {
        return await SaaSignal.create(data);
    }
}

module.exports = new SaaEngine();
