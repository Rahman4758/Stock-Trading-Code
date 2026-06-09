require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const Stock = require('./src/models/Stock');
const DailyPrice = require('./src/models/DailyPrice');

function calculateSMA(data, index, period) {
    if (index < period - 1) return null;
    let sum = 0;
    for (let i = index - period + 1; i <= index; i++) {
        sum += data[i].close;
    }
    return sum / period;
}

function calculateHigh52W(data, index) {
    // Approx 250 trading days in 52 weeks
    const period = 250;
    const startIdx = Math.max(0, index - period + 1);
    let maxHigh = data[startIdx].high;
    for (let i = startIdx + 1; i <= index; i++) {
        if (data[i].high > maxHigh) maxHigh = data[i].high;
    }
    return maxHigh;
}

function calculateCMF(data, index, period = 20) {
    if (index < period - 1) return null;
    let sumMFV = 0;
    let sumVol = 0;
    for (let i = index - period + 1; i <= index; i++) {
        const d = data[i];
        if (d.high === d.low) continue;
        const mfm = ((d.close - d.low) - (d.high - d.close)) / (d.high - d.low);
        const mfv = mfm * d.volume;
        sumMFV += mfv;
        sumVol += d.volume;
    }
    if (sumVol === 0) return 0;
    return sumMFV / sumVol;
}

function calculateRSI(data, startIndex, period = 14, getValue = d => d.close) {
    if (data.length - startIndex < period + 1) return null;
    // Calculate for the specific slice up to the end
    // To be efficient for running RSI, we'll return an array of RSIs mapped to data index
}

// Full array running RSI
function computeRunningRSI(closes, period = 14) {
    const rsiArr = new Array(closes.length).fill(null);
    if (closes.length <= period) return rsiArr;

    let sumGain = 0, sumLoss = 0;
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) sumGain += change;
        else sumLoss -= change;
    }
    
    let avgGain = sumGain / period;
    let avgLoss = sumLoss / period;
    
    rsiArr[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));

    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        let gain = change > 0 ? change : 0;
        let loss = change < 0 ? -change : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) {
            rsiArr[i] = 100;
        } else {
            rsiArr[i] = 100 - (100 / (1 + (avgGain / avgLoss)));
        }
    }
    return rsiArr;
}

function computeWeeklyRSIForDaily(dailyData) {
    const weeklyData = [];
    let currentWeekStr = '';
    let currentWeekClose = 0;

    const dailyToWeeklyIdxMap = new Array(dailyData.length).fill(-1);

    // Group by ISO week (Monday-Sunday approximation using getWeek)
    for (let i = 0; i < dailyData.length; i++) {
        const d = dailyData[i];
        const date = new Date(d.date);
        
        // Simple week string: Year-WeekNumber
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        const weekStr = `${date.getFullYear()}-W${weekNum}`;

        if (weekStr !== currentWeekStr) {
            if (currentWeekStr !== '') {
                weeklyData.push(currentWeekClose);
            }
            currentWeekStr = weekStr;
        }
        currentWeekClose = d.close;
        
        // This index points to the week array index once it is pushed!
        // We actually want the current length because the week is building.
        dailyToWeeklyIdxMap[i] = weeklyData.length;
    }
    if (currentWeekStr !== '') {
        weeklyData.push(currentWeekClose); // Push the last week
    }

    const weeklyRsiArr = computeRunningRSI(weeklyData, 14);

    // Map back to daily
    const dailyRsiWeekly = new Array(dailyData.length).fill(null);
    for (let i = 0; i < dailyData.length; i++) {
        const weekIdx = dailyToWeeklyIdxMap[i];
        dailyRsiWeekly[i] = weeklyRsiArr[weekIdx];
    }
    
    return dailyRsiWeekly;
}

async function run() {
    await connectMongo();
    const stocks = await Stock.find({ isActive: true }).lean();
    
    console.log(`Starting technical backfill for ${stocks.length} active stocks...`);

    for (let s = 0; s < stocks.length; s++) {
        const symbol = stocks[s].symbol;
        const data = await DailyPrice.find({ symbol }).sort({ date: 1 }).lean();
        if (data.length === 0) continue;

        let obv = 0;
        const closes = data.map(d => d.close);
        const dailyRsiArr = computeRunningRSI(closes, 14);
        const weeklyRsiArr = computeWeeklyRSIForDaily(data);

        const bulkOps = [];

        for (let i = 0; i < data.length; i++) {
            const d = data[i];

            // OBV calculation
            if (i > 0) {
                if (d.close > data[i - 1].close) obv += d.volume;
                else if (d.close < data[i - 1].close) obv -= d.volume;
            } else {
                obv = d.volume;
            }

            const updates = {
                obv: obv,
                sma50: calculateSMA(data, i, 50),
                sma200: calculateSMA(data, i, 200),
                high52w: calculateHigh52W(data, i),
                cmf: calculateCMF(data, i, 20),
                rsi14: dailyRsiArr[i],
                rsiWeekly: weeklyRsiArr[i]
            };

            // Remove nulls so we don't overwrite with nulls unnecessarily, though Mongoose will handle it
            Object.keys(updates).forEach(key => updates[key] === null && delete updates[key]);

            bulkOps.push({
                updateOne: {
                    filter: { _id: d._id },
                    update: { $set: updates }
                }
            });
        }

        if (bulkOps.length > 0) {
            await DailyPrice.bulkWrite(bulkOps, { ordered: false });
        }
        process.stdout.write(`\rProcessed ${s + 1}/${stocks.length} - ${symbol}      `);
    }

    console.log('\nTechnical backfill complete!');
    process.exit(0);
}

run();
