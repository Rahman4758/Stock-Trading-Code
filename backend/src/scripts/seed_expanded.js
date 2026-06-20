const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { connectMongo } = require('../config/db');
const Stock = require('../models/Stock');
const dns = require('dns');

// Fix SRV resolution
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const URLS = {
    FNO: 'https://archives.nseindia.com/content/fo/fo_mktlots.csv',
    NIFTY_50: 'https://archives.nseindia.com/content/indices/ind_nifty50list.csv',
    NIFTY_NEXT_50: 'https://archives.nseindia.com/content/indices/ind_niftynext50list.csv',
    NIFTY_MIDCAP_150: 'https://archives.nseindia.com/content/indices/ind_niftymidcap150list.csv',
};

const axiosConfig = {
    headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }
};

async function downloadCSV(url, filename) {
    const filePath = path.join(__dirname, '..', '..', 'temp', filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`Downloading ${url}...`);
    const response = await axios({ url, method: 'GET', responseType: 'stream', ...axiosConfig });
    
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
}

async function parseCSV(filePath, isFnoFormat) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on('data', (data) => {
                const symbol = data.Symbol || data.SYMBOL;
                if (!symbol || symbol === 'Symbol' || symbol === 'SYMBOL') return;
                
                results.push({
                    symbol: symbol.trim(),
                    name: (data['Company Name'] || data['NAME'] || symbol).trim(),
                    sector: (data.Sector || data.Industry || 'Unknown').trim()
                });
            })
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

async function seed() {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    await connectMongo();
    
    const fnoFile = await downloadCSV(URLS.FNO, 'fno.csv');
    const n50File = await downloadCSV(URLS.NIFTY_50, 'n50.csv');
    const nn50File = await downloadCSV(URLS.NIFTY_NEXT_50, 'nn50.csv');
    const mid150File = await downloadCSV(URLS.NIFTY_MIDCAP_150, 'mid150.csv');

    const fnoStocks = await parseCSV(fnoFile, true);
    const n50Stocks = await parseCSV(n50File, false);
    const nn50Stocks = await parseCSV(nn50File, false);
    const mid150Stocks = await parseCSV(mid150File, false);

    console.log(`Parsed: FNO=${fnoStocks.length}, N50=${n50Stocks.length}, NN50=${nn50Stocks.length}, MID150=${mid150Stocks.length}`);

    const stockMap = new Map();

    // 1. Mark N50
    for (const s of n50Stocks) stockMap.set(s.symbol, { ...s, indexCategory: 'NIFTY_50' });
    // 2. Mark NN50
    for (const s of nn50Stocks) stockMap.set(s.symbol, { ...s, indexCategory: 'NIFTY_NEXT_50' });
    // 3. Mark Midcap 150
    for (const s of mid150Stocks) stockMap.set(s.symbol, { ...s, indexCategory: 'NIFTY_MIDCAP_150' });
    // 4. Mark FNO overrides (All F&O stocks get flagged as FNO in category to prioritize OI, and isFno = true)
    for (const s of fnoStocks) {
        if (stockMap.has(s.symbol)) {
            const existing = stockMap.get(s.symbol);
            existing.isFno = true;
            // We can leave their indexCategory as NIFTY_50 etc., but let's set isFno to true.
            // If they are not in the above indices, they are just FNO.
        } else {
            stockMap.set(s.symbol, { ...s, indexCategory: 'FNO', isFno: true });
        }
    }

    // Ensure we set isFno=true for any existing map entries that happen to be in FNO
    const fnoSymbols = new Set(fnoStocks.map(s => s.symbol));
    for (const [sym, data] of stockMap.entries()) {
        if (fnoSymbols.has(sym)) {
            data.isFno = true;
            if (data.indexCategory === undefined) data.indexCategory = 'FNO';
        } else {
            data.isFno = false;
        }
    }

    let created = 0, updated = 0;
    for (const [symbol, data] of stockMap.entries()) {
        const result = await Stock.findOneAndUpdate(
            { symbol },
            { $set: { ...data, isActive: true } },
            { upsert: true, new: true }
        );
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created++;
        } else {
            updated++;
        }
    }

    console.log(`Seed complete! Created: ${created}, Updated: ${updated}`);
    process.exit(0);
}

seed().catch(console.error);
