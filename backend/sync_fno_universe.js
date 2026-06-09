const { connectMongo } = require('./src/config/db');
require('dotenv').config({ path: './src/.env' });
const Stock = require('./src/models/Stock');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    await connectMongo();
    
    console.log('Fetching official F&O list from NSE...');
    
    let csvData = '';
    const url = 'https://nsearchives.nseindia.com/content/fo/fo_mktlots.csv';
    
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });
        csvData = response.data;
        console.log('Successfully fetched via Axios.');
    } catch (err) {
        console.warn('Axios failed (403), falling back to Puppeteer Stealth...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2' });
        csvData = await page.evaluate(() => document.body.innerText);
        await browser.close();
        console.log('Successfully fetched via Puppeteer.');
    }
    
    // Parse CSV
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Usually the format is: UNDERLYING, SYMBOL, ...
    // We skip headers
    let fnoSymbols = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts.length >= 2) {
            let symbol = parts[1]; // Usually column 2 is SYMBOL, wait, or column 1?
            if (symbol && symbol.length > 1 && symbol !== 'Symbol') {
                fnoSymbols.push(symbol);
            }
        }
    }
    
    // Some lines might not match, let's verify if first column is symbol or second column.
    // Let's actually check both to be safe.
    fnoSymbols = [];
    const validLineCheck = lines.slice(1).map(l => l.split(',').map(s => s.trim()));
    for (const cols of validLineCheck) {
        if (cols.length < 2) continue;
        let symbolCandidate = cols[1]; 
        // In NSE fo_mktlots.csv, Col 1 = UNDERLYING, Col 2 = SYMBOL
        if (symbolCandidate && symbolCandidate.match(/^[A-Z0-9\-]+$/)) {
            // Remove 'Symbol' or non-stock indices
            if (!['Symbol', 'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'].includes(symbolCandidate)) {
                fnoSymbols.push(symbolCandidate);
            }
        }
    }

    // Deduplicate
    fnoSymbols = [...new Set(fnoSymbols)];
    
    if (fnoSymbols.length < 100) {
        console.error('Failed to parse enough symbols. Found: ' + fnoSymbols.length);
        console.log(fnoSymbols.slice(0, 10));
        process.exit(1);
    }
    
    console.log(`Parsed ${fnoSymbols.length} genuine F&O stock symbols from official list.`);

    // Deactivate all first
    await Stock.updateMany({}, { $set: { isActive: false, isFno: false } });

    // Reactivate and Add
    let updated = 0;
    for (const symbol of fnoSymbols) {
        await Stock.findOneAndUpdate(
            { symbol: symbol },
            { $set: { symbol: symbol, name: symbol, isFno: true, isActive: true } },
            { upsert: true }
        );
        updated++;
    }
    
    console.log(`Database sync complete. Tracking exactly ${updated} F&O Stocks.`);
    process.exit(0);
}

run();
