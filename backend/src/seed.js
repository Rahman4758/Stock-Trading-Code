/**
 * Seed script — populates MongoDB with all Nifty 50 stocks
 * Run: node --env-file=src/.env src/seed.js
 */

const { connectMongo } = require('./config/db');
const Stock = require('./models/Stock');

// All Nifty 50 stocks with sector index mappings
const STOCKS = [
    // Banking & Financial Services (NIFTY_BANK / NIFTY_FINANCIAL)
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Financials', industry: 'Banking', sectorIndex: 'NIFTY_BANK', isFno: true, lotSize: 550 },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Financials', industry: 'Banking', sectorIndex: 'NIFTY_BANK', isFno: true, lotSize: 700 },
    { symbol: 'SBIN', name: 'State Bank of India', sector: 'Financials', industry: 'Banking', sectorIndex: 'NIFTY_BANK', isFno: true, lotSize: 1500 },
    { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Financials', industry: 'Banking', sectorIndex: 'NIFTY_BANK', isFno: true, lotSize: 900 },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Financials', industry: 'Banking', sectorIndex: 'NIFTY_BANK', isFno: true, lotSize: 400 },
    { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd', sector: 'Financials', industry: 'Banking', sectorIndex: 'NIFTY_BANK', isFno: true, lotSize: 400 },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'Financials', industry: 'NBFC', sectorIndex: 'NIFTY_FINANCIAL', isFno: true, lotSize: 125 },
    { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', sector: 'Financials', industry: 'NBFC', sectorIndex: 'NIFTY_FINANCIAL', isFno: true, lotSize: 500 },
    { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', sector: 'Financials', industry: 'Insurance', sectorIndex: 'NIFTY_FINANCIAL', isFno: true, lotSize: 1100 },
    { symbol: 'SBILIFE', name: 'SBI Life Insurance', sector: 'Financials', industry: 'Insurance', sectorIndex: 'NIFTY_FINANCIAL', isFno: true, lotSize: 600 },

    // Information Technology (NIFTY_IT)
    { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', industry: 'IT Services', sectorIndex: 'NIFTY_IT', isFno: true, lotSize: 175 },
    { symbol: 'INFY', name: 'Infosys Ltd', sector: 'Technology', industry: 'IT Services', sectorIndex: 'NIFTY_IT', isFno: true, lotSize: 400 },
    { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'Technology', industry: 'IT Services', sectorIndex: 'NIFTY_IT', isFno: true, lotSize: 1500 },
    { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', sector: 'Technology', industry: 'IT Services', sectorIndex: 'NIFTY_IT', isFno: true, lotSize: 350 },
    { symbol: 'TECHM', name: 'Tech Mahindra Ltd', sector: 'Technology', industry: 'IT Services', sectorIndex: 'NIFTY_IT', isFno: true, lotSize: 600 },
    { symbol: 'LTIM', name: 'LTIMindtree Ltd', sector: 'Technology', industry: 'IT Services', sectorIndex: 'NIFTY_IT', isFno: true, lotSize: 150 },

    // Energy & Oil (NIFTY_ENERGY)
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy', industry: 'Oil & Gas', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 250 },
    { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', industry: 'Oil & Gas', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 3850 },
    { symbol: 'NTPC', name: 'NTPC Ltd', sector: 'Energy', industry: 'Power', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 2850 },
    { symbol: 'POWERGRID', name: 'Power Grid Corp of India', sector: 'Utilities', industry: 'Power', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 2700 },
    { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ', sector: 'Industrials', industry: 'Ports', sectorIndex: 'NIFTY_INFRA', isFno: true, lotSize: 625 },
    { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', sector: 'Industrials', industry: 'Conglomerate', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 250 },
    { symbol: 'BPCL', name: 'Bharat Petroleum Corp', sector: 'Energy', industry: 'Oil & Gas', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 1800 },
    { symbol: 'COALINDIA', name: 'Coal India Ltd', sector: 'Energy', industry: 'Mining', sectorIndex: 'NIFTY_ENERGY', isFno: true, lotSize: 2100 },

    // Consumer Staples (NIFTY_FMCG)
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'Consumer Staples', industry: 'FMCG', sectorIndex: 'NIFTY_FMCG', isFno: true, lotSize: 300 },
    { symbol: 'ITC', name: 'ITC Ltd', sector: 'Consumer Staples', industry: 'FMCG', sectorIndex: 'NIFTY_FMCG', isFno: true, lotSize: 1600 },
    { symbol: 'NESTLEIND', name: 'Nestle India Ltd', sector: 'Consumer Staples', industry: 'FMCG', sectorIndex: 'NIFTY_FMCG', isFno: true, lotSize: 25 },
    { symbol: 'BRITANNIA', name: 'Britannia Industries', sector: 'Consumer Staples', industry: 'FMCG', sectorIndex: 'NIFTY_FMCG', isFno: true, lotSize: 100 },
    { symbol: 'TATACONSUM', name: 'Tata Consumer Products', sector: 'Consumer Staples', industry: 'FMCG', sectorIndex: 'NIFTY_FMCG', isFno: true, lotSize: 600 },

    // Consumer Discretionary (NIFTY_AUTO)
    { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Consumer Disc.', industry: 'Automobiles', sectorIndex: 'NIFTY_AUTO', isFno: true, lotSize: 50 },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Consumer Disc.', industry: 'Automobiles', sectorIndex: 'NIFTY_AUTO', isFno: true, lotSize: 550 },
    { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd', sector: 'Consumer Disc.', industry: 'Automobiles', sectorIndex: 'NIFTY_AUTO', isFno: true, lotSize: 350 },
    { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', sector: 'Consumer Disc.', industry: 'Automobiles', sectorIndex: 'NIFTY_AUTO', isFno: true, lotSize: 75 },
    { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', sector: 'Consumer Disc.', industry: 'Automobiles', sectorIndex: 'NIFTY_AUTO', isFno: true, lotSize: 150 },
    { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd', sector: 'Consumer Disc.', industry: 'Automobiles', sectorIndex: 'NIFTY_AUTO', isFno: true, lotSize: 175 },
    { symbol: 'TITAN', name: 'Titan Company Ltd', sector: 'Consumer Disc.', industry: 'Jewellery', sectorIndex: 'NIFTY_FMCG', isFno: true, lotSize: 175 },

    // Healthcare & Pharma (NIFTY_PHARMA)
    { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Healthcare', industry: 'Pharma', sectorIndex: 'NIFTY_PHARMA', isFno: true, lotSize: 350 },
    { symbol: 'DRREDDY', name: 'Dr. Reddys Laboratories', sector: 'Healthcare', industry: 'Pharma', sectorIndex: 'NIFTY_PHARMA', isFno: true, lotSize: 125 },
    { symbol: 'CIPLA', name: 'Cipla Ltd', sector: 'Healthcare', industry: 'Pharma', sectorIndex: 'NIFTY_PHARMA', isFno: true, lotSize: 650 },
    { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'Healthcare', industry: 'Hospitals', sectorIndex: 'NIFTY_HEALTHCARE', isFno: true, lotSize: 125 },
    { symbol: 'DIVISLAB', name: 'Divi\'s Laboratories', sector: 'Healthcare', industry: 'Pharma', sectorIndex: 'NIFTY_PHARMA', isFno: true, lotSize: 175 },

    // Industrials & Infrastructure (NIFTY_INFRA)
    { symbol: 'LT', name: 'Larsen & Toubro Ltd', sector: 'Industrials', industry: 'Construction', sectorIndex: 'NIFTY_INFRA', isFno: true, lotSize: 150 },
    { symbol: 'GRASIM', name: 'Grasim Industries Ltd', sector: 'Industrials', industry: 'Diversified', sectorIndex: 'NIFTY_INFRA', isFno: true, lotSize: 250 },

    // Materials (NIFTY_METAL)
    { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', sector: 'Materials', industry: 'Cement', sectorIndex: 'NIFTY_METAL', isFno: true, lotSize: 50 },
    { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', sector: 'Materials', industry: 'Steel', sectorIndex: 'NIFTY_METAL', isFno: true, lotSize: 675 },
    { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', sector: 'Materials', industry: 'Steel', sectorIndex: 'NIFTY_METAL', isFno: true, lotSize: 4250 },
    { symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'Materials', industry: 'Metals', sectorIndex: 'NIFTY_METAL', isFno: true, lotSize: 1075 },
    { symbol: 'SHREECEM', name: 'Shree Cement Ltd', sector: 'Materials', industry: 'Cement', sectorIndex: 'NIFTY_METAL', isFno: true, lotSize: 25 },

    // Telecom & Media (NIFTY_MEDIA)
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Communication', industry: 'Telecom', sectorIndex: 'NIFTY_MEDIA', isFno: true, lotSize: 475 },
];

const seed = async () => {
    await connectMongo();
    let created = 0, updated = 0;
    for (const s of STOCKS) {
        const result = await Stock.findOneAndUpdate(
            { symbol: s.symbol },
            { $set: { ...s, isActive: true } },
            { upsert: true, new: true }
        );
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created++;
        } else {
            updated++;
        }
    }
    console.log(`Seed complete: ${created} created, ${updated} updated. Total: ${STOCKS.length} Nifty 50 stocks.`);
    process.exit(0);
};

seed().catch((e) => { console.error(e); process.exit(1); });
