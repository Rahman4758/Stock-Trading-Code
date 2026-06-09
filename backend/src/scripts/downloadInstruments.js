const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function downloadAndExtract() {
    console.log("Downloading Upstox NSE Instrument JSON...");
    const url = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
    
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const zlib = require('zlib');
        
        const rawData = zlib.gunzipSync(response.data).toString('utf-8');
        const parsedData = JSON.parse(rawData);
        
        const symbolToIsin = {};
        let count = 0;
        
        // Loop through all instruments and capture the mapping
        for (const item of parsedData) {
            if (item.segment === 'NSE_EQ' || item.segment === 'BSE_EQ') {
                symbolToIsin[item.trading_symbol] = item.instrument_key;
                count++;
            }
        }
        
        const outputPath = path.join(__dirname, '..', 'data', 'upstox_instruments.json');
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(symbolToIsin, null, 2));
        console.log(`Extracted and mapped ${count} symbols -> ISINs.`);
        console.log(`Saved to ${outputPath}`);
    } catch (e) {
        console.error("Download failed:", e.message);
    }
}

downloadAndExtract().catch(console.error);
