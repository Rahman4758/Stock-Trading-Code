require('dotenv').config({ path: './src/.env' });
const mongoose = require('mongoose');
const axios = require('axios');
const admZip = require('adm-zip');
const csv = require('csv-parser');
const stream = require('stream');
const DailyPrice = require('./src/models/DailyPrice');
const { connectMongo } = require('./src/config/db');

/**
 * Authentic Delivery Backfill Tool
 * Downloads real NSE BhavCopy (Consolidated Full Report) 
 * and populates DailyPrice.deliveryPct.
 */
async function backfill(dateStr = null) {
    try {
        await connectMongo();
        
        const date = dateStr ? new Date(dateStr) : new Date();
        // Indian markets close at 3:30 PM. Data usually available by 6 PM.
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        // NSE consolidated bhavcopy URL pattern
        // Example: https://archives.nseindia.com/products/content/sec_bhavdata_full_12042024.csv
        const fileName = `sec_bhavdata_full_${day}${month}${year}.csv`;
        const url = `https://archives.nseindia.com/products/content/${fileName}`;
        
        console.log(`[Backfill] Downloading authentic NSE data from: ${url}`);
        
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        let count = 0;
        const processCsv = () => {
            return new Promise((resolve, reject) => {
                response.data
                    .pipe(csv())
                    .on('data', async (row) => {
                        // NSE CSV Columns: SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, 
                        // LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QT, TURNOVER_LACS, 
                        // NO_OF_TRADES, DELIV_QTY, DELIV_PER
                        
                        const symbol = row.SYMBOL?.trim();
                        const series = row.SERIES?.trim();
                        const delivPer = parseFloat(row.DELIV_PER?.trim());
                        const delivQty = parseInt(row.DELIV_QTY?.trim());

                        if (series === 'EQ' && !isNaN(delivPer)) {
                            await DailyPrice.findOneAndUpdate(
                                { symbol, date: { $gte: new Date(date).setHours(0,0,0,0), $lte: new Date(date).setHours(23,59,59,999) } },
                                { $set: { deliveryPct: delivPer, deliveryQty: delivQty } }
                            );
                            count++;
                        }
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        };

        await processCsv();
        console.log(`[Backfill] Successfully updated ${count} stocks with AUTHENTIC delivery data.`);
        
    } catch (err) {
        console.error(`[Backfill] Failed: ${err.message}`);
        if (err.response?.status === 404) {
            console.log('💡 Tip: NSE archives might not have today\'s data yet (usually available after 6 PM IST). Try yesterday\'s date.');
        }
    } finally {
        await mongoose.disconnect();
    }
}

// Default to yesterday if running during morning hours
const target = new Date();
if (target.getHours() < 18) target.setDate(target.getDate() - 1);

backfill(target.toISOString().split('T')[0]);
