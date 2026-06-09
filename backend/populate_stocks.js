const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const Stock = require('./src/models/Stock');

const TOP_60_FNO = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'ENERGY' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'BANK' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'BANK' },
    { symbol: 'INFY', name: 'Infosys', sector: 'IT' },
    { symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'METAL' },
    { symbol: 'TATASTEEL', name: 'Tata Steel', sector: 'METAL' },
    { symbol: 'SBIN', name: 'State Bank of India', sector: 'BANK' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'TELECOM' },
    { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG' },
    { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'BANK' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'BANK' },
    { symbol: 'LT', name: 'Larsen & Toubro', sector: 'CONSTRUCTION' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'FINANCE' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'AUTO' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharma', sector: 'PHARMA' },
    { symbol: 'TITAN', name: 'Titan Company', sector: 'CONSUMER' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'CONSUMER' },
    { symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'AUTO' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises', sector: 'METALS' },
    { symbol: 'ADANIPORTS', name: 'Adani Ports', sector: 'LOGISTICS' },
    { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'IT' },
    { symbol: 'ONGC', name: 'ONGC', sector: 'ENERGY' },
    { symbol: 'NTPC', name: 'NTPC', sector: 'ENERGY' },
    { symbol: 'JSWSTEEL', name: 'JSW Steel', sector: 'METAL' },
    { symbol: 'POWERGRID', name: 'Power Grid', sector: 'ENERGY' },
    { symbol: 'TATACHEM', name: 'Tata Chemicals', sector: 'CHEMICALS' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'AUTO' },
    { symbol: 'GRASIM', name: 'Grasim Industries', sector: 'CEMENT' },
    { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'CEMENT' },
    { symbol: 'NESTLEIND', name: 'Nestle India', sector: 'FMCG' },
    { symbol: 'COALINDIA', name: 'Coal India', sector: 'ENERGY' },
    { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', sector: 'FINANCE' },
    { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'HEALTHCARE' },
    { symbol: 'TECHM', name: 'Tech Mahindra', sector: 'IT' },
    { symbol: 'INDUSINDBK', name: 'IndusInd Bank', sector: 'BANK' },
    { symbol: 'BRITANNIA', name: 'Britannia Industries', sector: 'FMCG' },
    { symbol: 'EICHERMOT', name: 'Eicher Motors', sector: 'AUTO' },
    { symbol: 'DRREDDY', name: 'Dr Reddys Labs', sector: 'PHARMA' },
    { symbol: 'CIPLA', name: 'Cipla Limited', sector: 'PHARMA' },
    { symbol: 'DIVISLAB', name: 'Divis Labs', sector: 'PHARMA' },
    { symbol: 'BPCL', name: 'BPCL', sector: 'ENERGY' },
    { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', sector: 'AUTO' },
    { symbol: 'SBILIFE', name: 'SBI Life Insurance', sector: 'FINANCE' },
    { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', sector: 'FINANCE' },
    { symbol: 'WIPRO', name: 'Wipro Limited', sector: 'IT' },
    { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto', sector: 'AUTO' },
    { symbol: 'TATACONSUM', name: 'Tata Consumer', sector: 'FMCG' },
    { symbol: 'UPL', name: 'UPL Limited', sector: 'CHEMICALS' },
    { symbol: 'DLF', name: 'DLF Limited', sector: 'REALESTATE' },
    { symbol: 'CHOLAFIN', name: 'Cholamandalam Fin', sector: 'FINANCE' },
    { symbol: 'LTIM', name: 'LTIMindtree', sector: 'IT' },
    { symbol: 'VEDL', name: 'Vedanta Limited', sector: 'METALS' },
    { symbol: 'PIIND', name: 'PI Industries', sector: 'CHEMICALS' },
    { symbol: 'TRENT', name: 'Trent Limited', sector: 'RETAIL' },
    { symbol: 'TVSMOTOR', name: 'TVS Motor', sector: 'AUTO' },
    { symbol: 'HAL', name: 'Hindustan Aeronautics', sector: 'DEFENCE' },
    { symbol: 'BEL', name: 'Bharat Electronics', sector: 'DEFENCE' },
    { symbol: 'CUMMINSIND', name: 'Cummins India', sector: 'ENGINEERING' }
];

async function run() {
    await connectMongo();
    
    console.log('Populating Top 60 Stocks into Database...');
    
    for (const s of TOP_60_FNO) {
        await Stock.findOneAndUpdate(
            { symbol: s.symbol },
            { $set: { ...s, isFno: true, isActive: true } },
            { upsert: true }
        );
    }
    
    console.log('Stock population complete.');
    process.exit(0);
}

run();
