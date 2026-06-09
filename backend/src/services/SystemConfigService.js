const SystemConfig = require('../models/SystemConfig');

class SystemConfigService {
    constructor() {
        this.config = null;
        this.lastFetched = 0;
        this.TTL = 60000; // 1 minute cache
    }

    async getConfig() {
        const now = Date.now();
        if (this.config && (now - this.lastFetched) < this.TTL) {
            return this.config;
        }

        try {
            this.config = await SystemConfig.findOne({ config_id: 'current_weights' }).lean();
            this.lastFetched = now;
            
            // Fallback if DB is empty for some reason
            if (!this.config) {
                return {
                    weights: { fii_score_max: 25, dii_score_max: 20, pcr_score_max: 20, deliv_score_max: 15, fundamental_score_max: 10 },
                    thresholds: { scanner_min_confidence: 0.70, da_reject_threshold: 7, da_reduce_size_threshold: 6 }
                };
            }
            return this.config;
        } catch (error) {
            console.error('[SystemConfigService] Error fetching config:', error);
            return null;
        }
    }

    async refresh() {
        this.config = null;
        this.lastFetched = 0;
        return await this.getConfig();
    }
}

module.exports = new SystemConfigService();
