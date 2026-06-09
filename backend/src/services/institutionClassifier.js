const Institution = require('../models/Institution');
const BulkDeal = require('../models/BulkDeal');

class InstitutionClassifier {
    /**
     * Identify and classify a new institution from a bulk deal
     */
    async classify(name, clientType) {
        // Triers
        // 1 = Top Tier Smart Money (Foreign Funds, Big Domestic Funds, Prop Desks)
        // 2 = Institutional (Banks, Standard Mutual Funds)
        // 3 = Passive/Index Funds (ETFs)
        // 4 = Retail/HNI (Individuals, small firms)

        name = name.toUpperCase().trim();
        let tier = 4;
        let category = 'HNI';

        // Simple keyword-based heuristic for MVP
        if (name.includes('FUND') || name.includes('CAPITAL') || name.includes('ASSET')) {
            tier = 2;
            category = name.includes('INDIA') ? 'DII' : 'FII';

            // Upgrade tier if it's a known big player (mock logic, normally would be a DB lookup of AUM)
            if (name.includes('MORGAN STANLEY') || name.includes('GOLDMAN') || name.includes('VANGUARD')) {
                tier = 1;
            }
        }
        else if (name.includes('SECURITIES') || name.includes('EQUITIES') || name.includes('BROKING')) {
            tier = 1; // Assuming these are Prop Desks in bulk deal context
            category = 'PROPRIETARY';
        }
        else if (clientType) {
            if (clientType === 'FII') { tier = 2; category = 'FII'; }
            if (clientType === 'MUTUAL FUNDS') { tier = 2; category = 'DII'; }
        }

        const institution = new Institution({
            name,
            category,
            tier,
            reliabilityScore: tier === 1 ? 80 : tier === 2 ? 60 : 40
        });

        await institution.save();
        return institution;
    }

    /**
     * Run a weekly job to re-calculate "reliabilityScore" based on how their past deals performed
     */
    async evaluatePerformances() {
        // Mock method for future implementation
        // Would look at their average deal holding period and whether price was higher when they exited
        console.log('[Classifier] Evaluating institution win-rates...');
    }
}

module.exports = new InstitutionClassifier();
