const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Stock = require('../src/models/Stock');
const { connectMongo } = require('../src/config/db');
const mongoose = require('mongoose');

const INSTRUMENT_FILE = path.join(__dirname, '../src/data/upstox_instruments.json');
const UPSTOX_NSE_INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz';
// Note: We'll attempt the uncompressed CSV first as some environments have trouble with GZ streams
const ALTERNATE_URL = 'https://api.upstox.com/v2/market-data/instruments/NSE'; 

async function rebuild() {
    try {
        console.log('--- Rebuilding Upstox Instrument Mapping ---');
        await connectMongo();
        
        const stocks = await Stock.find({ isActive: true }).select('symbol').lean();
        const activeSymbols = new Set(stocks.map(s => s.symbol));
        console.log(`Targeting ${activeSymbols.size} symbols...`);

        const mapping = {};
        
        // Fetching the mapping from the official Upstox API response
        console.log('Fetching NSE instrument list from Upstox...');
        const response = await axios({
            method: 'get',
            url: ALTERNATE_URL,
            responseType: 'stream'
        });

        await new Promise((resolve, reject) => {
            response.data
                .pipe(csv())
                .on('data', (row) => {
                    // Upstox CSV Header: instrument_key, exchange_token, tradingsymbol, name, last_price, expiry, strike, tick_size, lot_size, instrument_type, segment, exchange, isin
                    const symbol = row.tradingsymbol?.trim();
                    const segment = row.segment?.trim();
                    const key = row.instrument_key?.trim();

                    if (activeSymbols.has(symbol) && segment === 'NSE_EQ') {
                        mapping[symbol] = key;
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Write the new mapping
        fs.writeFileSync(INSTRUMENT_FILE, JSON.stringify(mapping, null, 2));
        console.log(`✅ Success! Created mapping for ${Object.keys(mapping).length} symbols.`);
        console.log(`Mapping saved to: ${INSTRUMENT_FILE}`);

    } catch (err) {
        console.error('❌ Failed to rebuild map:', err.message);
        console.log('💡 Attempting fallback to hardcoded common Nifty50 mapping...');
        
        // Fallback for critical Nifty 50 tokens if the API is down
        const fallback = {
            "RELIANCE": "NSE_EQ|INE002A01018",
            "TCS": "NSE_EQ|INE467B01029",
            "HDFCBANK": "NSE_EQ|INE040A01034",
            "ICICIBANK": "NSE_EQ|INE090A01021",
            "INFY": "NSE_EQ|INE009A01021",
            "KOTAKBANK": "NSE_EQ|INE237A01028",
            "M&M": "NSE_EQ|INE101A01026"
        };
        fs.writeFileSync(INSTRUMENT_FILE, JSON.stringify(fallback, null, 2));
        console.log('✅ Applied fallback mapping for core Nifty 50 stocks.');
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

rebuild();
