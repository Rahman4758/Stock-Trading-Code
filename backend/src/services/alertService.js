const Portfolio = require('../models/Portfolio');
const DivergenceAlert = require('../models/DivergenceAlert');
const StockSelector = require('../core/stockSelector');
const DailyPrice = require('../models/DailyPrice');
const SmartMoneyScore = require('../models/SmartMoneyScore');
// In a real app we'd use nodemailer or a webhook trigger

class AlertService {
    /**
     * Run daily post-analysis to check if any user alerts should trigger
     */
    async runDailyChecks() {
        console.log('[AlertService] Running daily portfolio checks...');

        try {
            await this.checkPortfolioStopsAndTargets();
            await this.checkHighSeverityDivergences();

            console.log('[AlertService] Daily checks complete.');
        } catch (err) {
            console.error('[AlertService] Error during daily checks:', err.message);
        }
    }

    async checkPortfolioStopsAndTargets() {
        const items = await Portfolio.find().lean();

        for (const item of items) {
            try {
                // Get latest price
                const latestPrice = await DailyPrice.findOne({ symbol: item.symbol }).sort({ date: -1 }).lean();
                if (!latestPrice) continue;

                // Simple check if SL hit
                if (item.alertPrice && latestPrice.close <= item.alertPrice) {
                    this._sendAlert(`🚨 STOP LOSS HIT: ${item.symbol}`, `Price closed at ₹${latestPrice.close}, below your defined stop of ₹${item.alertPrice}`);
                    continue; // don't check targets if SL hit
                }

                // If no user alert price, rely on system analysis
                const score = await SmartMoneyScore.findOne({ symbol: item.symbol }).sort({ date: -1 }).lean();
                if (score && score.compositeScore < 40) {
                    this._sendAlert(`⚠️ SMART MONEY EXIT: ${item.symbol}`, `Composite score dropped to ${score.compositeScore}. Heavy distribution detected.`);
                }
            } catch (err) {
                console.error(`Error checking ${item.symbol}:`, err.message);
            }
        }
    }

    async checkHighSeverityDivergences() {
        // Find unacknowledged high severity divergence alerts from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alerts = await DivergenceAlert.find({
            severity: 'HIGH',
            acknowledged: false,
            date: { $gte: today }
        }).lean();

        for (const alert of alerts) {
            this._sendAlert(`🚨 DIVERGENCE ALERT: ${alert.symbol}`, `${alert.message}. Action: ${alert.actionRecommendation}`);
        }
    }

    _sendAlert(subject, message) {
        // Mock method - in reality this sends an email, SMS, or Slack webhook
        console.log('\n======================================================');
        console.log(`[ALERT DISPATCHED] ${subject}`);
        console.log(`[MESSAGE] ${message}`);
        console.log('======================================================\n');
    }
}

module.exports = new AlertService();
