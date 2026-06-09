const BaseCollector = require('./base');
const BulkDeal = require('../models/BulkDeal');
const Institution = require('../models/Institution');

// Categorization rules (ported from Python)
const CATEGORIZATION_RULES = {
    FII: ['FPI', 'FOREIGN', 'OFFSHORE', 'SINGAPORE', 'MAURITIUS', 'CLSA', 'MORGAN', 'GOLDMAN', 'BARCLAYS', 'CREDIT SUISSE', 'NOMURA', 'CITIGROUP', 'BNP', 'DEUTSCHE', 'UBS'],
    DII: ['MUTUAL FUND', 'INSURANCE', 'LIC', 'HDFC', 'ICICI', 'SBI', 'UTI', 'ADITYA BIRLA', 'RELIANCE NIPPON', 'KOTAK', 'AXIS', 'BAJAJ', 'MAX LIFE', 'TATA AIA'],
    PROPRIETARY: ['PROPRIETARY', 'PROP', 'TRADING', 'SECURITIES'],
};

const TIER_MAP = { FII: 2, DII: 2, PROPRIETARY: 1, HNI: 4 };

function categorizeClient(name) {
    const upper = name.toUpperCase();
    for (const [cat, patterns] of Object.entries(CATEGORIZATION_RULES)) {
        if (patterns.some((p) => upper.includes(p))) return cat;
    }
    return 'HNI';
}

async function getOrCreateInstitution(clientName, category) {
    let inst = await Institution.findOne({ name: clientName });
    if (!inst) {
        inst = await Institution.create({
            name: clientName,
            category,
            tier: TIER_MAP[category] || 4,
            strategyType: 'MIXED',
            reliabilityScore: 50,
        });
    }
    return inst;
}

class BulkDealsCollector extends BaseCollector {
    constructor() {
        super({
            sourceName: 'NSE_BULK_DEALS',
            baseUrl: 'https://www.nseindia.com',
            rateLimitCalls: 5,
            rateLimitPeriod: 60000,
        });
    }

    async collectForDate(date) {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        const dateStr = `${dd}-${mm}-${yyyy}`;

        try {
            const data = await this.request('GET', '/api/snapshot-capital-market-bulkdeals', { date: dateStr });
            if (!data?.data?.length) {
                console.warn(`[BulkDeals] No data for ${dateStr}`);
                return [];
            }

            return data.data.map((row) => {
                const quantity = typeof row.quantity === 'string'
                    ? parseInt(row.quantity.replace(/,/g, ''), 10)
                    : parseInt(row.quantity, 10);
                const price = typeof row.price === 'string'
                    ? parseFloat(row.price.replace(/,/g, ''))
                    : parseFloat(row.price);
                const category = categorizeClient(row.clientName);

                return {
                    date: new Date(yyyy, date.getMonth(), date.getDate()),
                    symbol: row.symbol,
                    clientName: row.clientName,
                    dealType: row.buyOrSell.toUpperCase(),
                    quantity,
                    price,
                    dealValue: Math.round(quantity * price * 100), // in paise
                    clientCategory: category,
                };
            });
        } catch (err) {
            console.error(`[BulkDeals] Failed for ${dateStr}: ${err.message}`);
            return [];
        }
    }

    async collect({ days = 1 } = {}) {
        await this.initCookies();

        let totalDeals = 0;
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            const rows = await this.collectForDate(date);
            if (!rows.length) continue;

            for (const row of rows) {
                const institution = await getOrCreateInstitution(row.clientName, row.clientCategory);
                row.institutionId = institution._id;

                // Skip duplicates
                const exists = await BulkDeal.findOne({
                    date: row.date,
                    symbol: row.symbol,
                    clientName: row.clientName,
                    dealType: row.dealType,
                    quantity: row.quantity,
                });
                if (!exists) {
                    await BulkDeal.create(row);
                    totalDeals++;
                }
            }
            console.log(`[BulkDeals] Day -${i}: ${rows.length} deals processed`);
        }

        return { count: totalDeals, daysCollected: days };
    }
}

module.exports = BulkDealsCollector;
