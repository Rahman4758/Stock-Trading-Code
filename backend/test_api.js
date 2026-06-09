/**
 * Verification Script to check API endpoints
 */
const http = require('http');

function fetchApi(path) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:4000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} on ${path}`));
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

async function run() {
    console.log('--- API Verification ---');
    try {
        // 1. Dashboard (Latest Scans)
        console.log('\n[5] Fetching /api/v1/stocks/POWERGRID');
        try {
            const stock = await fetchApi('/api/v1/stocks/POWERGRID');
            console.log('Stock response:', stock);
            // 2. Footprint for POWERGRID
            console.log('\n[2] Fetching /api/v1/footprint/POWERGRID?days=90');
            const fp = await fetchApi('/api/v1/footprint/POWERGRID?days=90');
            console.log('Footprint keys:', Object.keys(fp));
            const lastCandle = fp.chartData[fp.chartData.length - 1];
            console.log('Footprint LAST candle:', lastCandle);
        } catch (e) {
            console.log('Stock endpoint failed:', e.message);
        }

        console.log('\n[6] Fetching /api/v1/stocks/POWERGRID/analysis');
        try {
            const analysis = await fetchApi('/api/v1/stocks/POWERGRID/analysis');
            console.log('Analysis response keys:', Object.keys(analysis));
            console.log('Analysis scores:', analysis.scores);
        } catch (e) {
            console.log('Analysis endpoint failed:', e.message);
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

run();
