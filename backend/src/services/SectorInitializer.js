const SectorStock = require('../models/SectorStock');

/**
 * SectorInitializer
 * Populates the SectorStock collection with authentic Nifty sector constituents.
 * This ensures that the Sector Radar shows real stocks instead of mock data.
 */
class SectorInitializer {
    constructor() {
        this.mappings = {
            'IT': [
                { symbol: 'TCS', name: 'Tata Consultancy Services' },
                { symbol: 'INFY', name: 'Infosys' },
                { symbol: 'HCLTECH', name: 'HCL Technologies' },
                { symbol: 'WIPRO', name: 'Wipro' },
                { symbol: 'LTIM', name: 'LTIMindtree' },
                { symbol: 'TECHM', name: 'Tech Mahindra' },
                { symbol: 'COFORGE', name: 'Coforge' },
                { symbol: 'PERSISTENT', name: 'Persistent Systems' }
            ],
            'BANK': [
                { symbol: 'HDFCBANK', name: 'HDFC Bank' },
                { symbol: 'ICICIBANK', name: 'ICICI Bank' },
                { symbol: 'SBIN', name: 'State Bank of India' },
                { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
                { symbol: 'AXISBANK', name: 'Axis Bank' },
                { symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
                { symbol: 'BANKBARODA', name: 'Bank of Baroda' },
                { symbol: 'PNB', name: 'Punjab National Bank' }
            ],
            'AUTO': [
                { symbol: 'MARUTI', name: 'Maruti Suzuki India' },
                { symbol: 'TATAMOTORS', name: 'Tata Motors' },
                { symbol: 'M&M', name: 'Mahindra & Mahindra' },
                { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto' },
                { symbol: 'EICHERMOT', name: 'Eicher Motors' },
                { symbol: 'TVSMOTOR', name: 'TVS Motor Company' },
                { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp' },
                { symbol: 'ASHOKLEY', name: 'Ashok Leyland' }
            ],
            'PHARMA': [
                { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical' },
                { symbol: 'CIPLA', name: 'Cipla' },
                { symbol: 'DRREDDY', name: 'Dr. Reddys Laboratories' },
                { symbol: 'DIVISLAB', name: 'Divis Laboratories' },
                { symbol: 'ZYDUSLIFE', name: 'Zydus Lifesciences' },
                { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals' },
                { symbol: 'LUPIN', name: 'Lupin' },
                { symbol: 'TORNTPHARM', name: 'Torrent Pharmaceuticals' }
            ],
            'FMCG': [
                { symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
                { symbol: 'ITC', name: 'ITC Limited' },
                { symbol: 'NESTLEIND', name: 'Nestle India' },
                { symbol: 'BRITANNIA', name: 'Britannia Industries' },
                { symbol: 'TATACONSUM', name: 'Tata Consumer Products' },
                { symbol: 'VBL', name: 'Varun Beverages' },
                { symbol: 'GODREJCP', name: 'Godrej Consumer Products' },
                { symbol: 'DABUR', name: 'Dabur India' }
            ],
            'METAL': [
                { symbol: 'TATASTEEL', name: 'Tata Steel' },
                { symbol: 'HINDALCO', name: 'Hindalco Industries' },
                { symbol: 'JINDALSTEL', name: 'Jindal Steel & Power' },
                { symbol: 'JSWSTEEL', name: 'JSW Steel' },
                { symbol: 'VEDL', name: 'Vedanta' },
                { symbol: 'NMDC', name: 'NMDC Limited' },
                { symbol: 'SAIL', name: 'Steel Authority of India' },
                { symbol: 'NATIONALUM', name: 'National Aluminium' }
            ],
            'REALTY': [
                { symbol: 'DLF', name: 'DLF Limited' },
                { symbol: 'LODHA', name: 'Macrotech Developers' },
                { symbol: 'GODREJPROP', name: 'Godrej Properties' },
                { symbol: 'OBEROIRLTY', name: 'Oberoi Realty' },
                { symbol: 'PHOENIXLTD', name: 'The Phoenix Mills' },
                { symbol: 'PRESTIGE', name: 'Prestige Estates' },
                { symbol: 'SOBHA', name: 'Sobha Limited' },
                { symbol: 'BRIGADE', name: 'Brigade Enterprises' }
            ],
            'ENERGY': [
                { symbol: 'RELIANCE', name: 'Reliance Industries' },
                { symbol: 'ONGC', name: 'Oil & Natural Gas Corp' },
                { symbol: 'NTPC', name: 'NTPC Limited' },
                { symbol: 'POWERGRID', name: 'Power Grid Corp' },
                { symbol: 'BPCL', name: 'Bharat Petroleum' },
                { symbol: 'IOC', name: 'Indian Oil Corp' },
                { symbol: 'GAIL', name: 'GAIL (India)' },
                { symbol: 'ADANIGREEN', name: 'Adani Green Energy' }
            ]
        };
    }

    async init() {
        console.log('[SectorInitializer] Syncing sector-stock mappings...');
        let total = 0;
        for (const [sector, stocks] of Object.entries(this.mappings)) {
            for (const stock of stocks) {
                await SectorStock.findOneAndUpdate(
                    { symbol: stock.symbol },
                    { 
                        $set: { 
                            sector_id: sector, 
                            name: stock.name,
                            last_updated: new Date()
                        } 
                    },
                    { upsert: true }
                );
                total++;
            }
        }
        console.log(`[SectorInitializer] Done. Mapped ${total} stocks to 8 sectors.`);
    }
}

module.exports = new SectorInitializer();
