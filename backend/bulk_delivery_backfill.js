require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const axios = require('axios');
const csv = require('csv-parser');
const DailyPrice = require('./src/models/DailyPrice');
const { connectMongo } = require('./src/config/db');

async function downloadBhavcopy(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    const fileName = `sec_bhavdata_full_${day}${month}${year}.csv`;
    const url = `https://archives.nseindia.com/products/content/${fileName}`;
    
    console.log(`[Delivery] Downloading: ${url}`);
    
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000
        });

        let count = 0;
        const promises = [];
        
        // Exact bounds for the UTC date the database uses
        const start = new Date(Date.UTC(year, date.getMonth(), date.getDate(), 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, date.getMonth(), date.getDate(), 23, 59, 59, 999));

        await new Promise((resolve, reject) => {
            response.data.pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
                .on('data', (row) => {
                    const symbol = row.SYMBOL?.trim();
                    const series = row.SERIES?.trim();
                    const delivPer = parseFloat(row.DELIV_PER?.trim() || row['DELIV_PER']?.trim());
                    const delivQty = parseInt(row.DELIV_QTY?.trim() || row['DELIV_QTY']?.trim());

                    if (series === 'EQ' && !isNaN(delivPer)) {
                        const p = DailyPrice.findOneAndUpdate(
                            { symbol, date: { $gte: start, $lte: end } },
                            { $set: { deliveryPct: delivPer, deliveryQty: delivQty } }
                        ).then(res => { if(res) count++; });
                        promises.push(p);
                    }
                })
                .on('end', () => {
                    Promise.all(promises).then(() => resolve()).catch(reject);
                })
                .on('error', reject);
        });
        console.log(`✅ Success for ${date.toISOString().split('T')[0]}: Updated ${count} records.`);
    } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 403) {
            console.log(`⏭️ Skipped ${date.toISOString().split('T')[0]} (Holiday/Weekend or not available)`);
        } else {
            console.error(`❌ Failed ${date.toISOString().split('T')[0]}: ${err.message}`);
        }
    }
}

async function run() {
    await connectMongo();
    
    console.log('Starting 15-day bulk delivery backfill...');
    
    for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        await downloadBhavcopy(d);
    }
    
    console.log('Bulk delivery backfill complete.');
    process.exit(0);
}

run();
