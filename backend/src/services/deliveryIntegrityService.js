const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const DailyPrice = require('../models/DailyPrice');

class DeliveryIntegrityService {
    async syncDelivery(date = new Date()) {
        let attempts = 0;
        let success = false;
        let targetDate = new Date(date);
        let updatedCount = 0;

        const marketCalendar = require('./MarketCalendar');

        while (attempts < 3 && !success) {
            // Ensure we are targeting a TRADING DAY
            while (!marketCalendar.isTradingDay(targetDate)) {
                targetDate.setDate(targetDate.getDate() - 1);
            }

            const dateStr = this._formatDate(targetDate);
            const url = `https://www.nseindia.com/api/reports/archives?index=all&date=${this._formatNseApiDate(targetDate)}&type=sec_bhavdata_full`;
            // ALTERNATIVE (Fallback to archives if API is blocked)
            const archiveUrl = `https://archives.nseindia.com/products/content/sec_bhavdata_full_${dateStr}.csv`;
            
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            
            const tempPath = path.join(tempDir, `temp_bhavcopy_${dateStr}.csv`);

            console.log(`[DeliveryService] Attempt ${attempts + 1}: Fetching from ${archiveUrl}`);

            try {
                const response = await axios({
                    method: 'get',
                    url: archiveUrl,
                    responseType: 'stream',
                    timeout: 15000,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Referer': 'https://www.nseindia.com/all-reports'
                    }
                });

                const writer = fs.createWriteStream(tempPath);
                response.data.pipe(writer);

                updatedCount = await new Promise((resolve, reject) => {
                    writer.on('finish', () => {
                        this._processCsv(tempPath, targetDate)
                            .then(resolve)
                            .catch(reject)
                            .finally(() => {
                                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                            });
                    });
                    writer.on('error', reject);
                });

                if (updatedCount > 0) {
                    success = true;
                    console.log(`[DeliveryService] Successfully synced ${updatedCount} delivery records for ${dateStr}`);
                } else {
                    throw new Error('CSV processed but 0 EQ records found');
                }

            } catch (err) {
                console.warn(`[DeliveryService] Date ${dateStr} failed: ${err.message}`);
                // Move to PREVIOUS trading day for next attempt if today is genuinely not there yet
                targetDate.setDate(targetDate.getDate() - 1);
                attempts++;
            }
        }

        if (!success) {
            throw new Error(`Failed to acquire authentic delivery data after 3 attempts.`);
        }

        return updatedCount;
    }

    _formatDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}${month}${year}`;
    }

    _formatNseApiDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    async _processCsv(filePath, targetDate) {
        return new Promise((resolve, reject) => {
            const results = [];
            const dateObj = new Date(targetDate);
            dateObj.setUTCHours(12, 0, 0, 0);

            fs.createReadStream(filePath)
                .pipe(csv({
                    mapHeaders: ({ header }) => header.trim() // TRIM HEADERS TO REMOVE SPACES
                }))
                .on('data', (data) => {
                    const symbol = data.SYMBOL?.trim();
                    const series = data.SERIES?.trim();
                    const delivPct = parseFloat(data.DELIV_PER?.trim());

                    if (series === 'EQ' && !isNaN(delivPct)) {
                        if (results.length < 5) console.log(`[Debug] Parsed: ${symbol} | Series: ${series} | Del%: ${delivPct}`);
                        results.push({ symbol, delivPct });
                    }
                })
                .on('end', async () => {
                    console.log(`[DeliveryService] Parsed ${results.length} delivery records. Updating DB...`);
                    
                    const startOfDay = new Date(targetDate);
                    startOfDay.setUTCHours(0, 0, 0, 0);
                    const endOfDay = new Date(targetDate);
                    endOfDay.setUTCHours(23, 59, 59, 999);

                    let updated = 0;
                    for (const res of results) {
                        const update = await DailyPrice.findOneAndUpdate(
                            { 
                                symbol: res.symbol, 
                                date: { $gte: startOfDay, $lte: endOfDay } 
                            },
                            { $set: { deliveryPct: res.delivPct } },
                            { upsert: false }
                        );
                        if (update) updated++;
                    }
                    resolve(updated);
                })
                .on('error', reject);
        });
    }
}

module.exports = new DeliveryIntegrityService();
