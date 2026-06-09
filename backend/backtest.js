require('dotenv').config({ path: './src/.env' });
const { connectMongo } = require('./src/config/db');
const Stock = require('./src/models/Stock');
const DailyPrice = require('./src/models/DailyPrice');
const fs = require('fs');

async function run() {
    await connectMongo();
    
    const activeStocks = await Stock.find({ isActive: true }).lean();
    console.log(`Starting backtest for ${activeStocks.length} stocks...`);

    // We will test the last 60 trading days
    const TEST_DAYS = 60;
    const resultsByDate = {}; // { 'YYYY-MM-DD': [ {symbol, score, close} ] }

    for (const stock of activeStocks) {
        const symbol = stock.symbol;
        
        // Fetch last 300 trading days for the stock
        const priceDocs = await DailyPrice.find({ symbol }).sort({ date: -1 }).limit(300).lean();
        
        // We need at least TEST_DAYS + 20 days of data to compute slopes/averages accurately
        if (priceDocs.length < TEST_DAYS + 25) continue;

        // Loop through each of the last TEST_DAYS (day 0 is today, day 1 is yesterday, etc.)
        for (let dayIdx = 0; dayIdx < TEST_DAYS; dayIdx++) {
            const latest = priceDocs[dayIdx];
            const close = latest.close;
            const dateStr = new Date(latest.date).toISOString().split('T')[0];

            let score = 0;
            const checklist = {
                priceAbove50DMA: false,
                priceAbove200DMA: false,
                near52WHigh: false,
                rsStrong: false,
                obvRising: false,
                cmfPositive: false,
                deliveryIncreasing: false,
                volumeDrying: false,
                breakoutVolume: false
            };

            // 1 & 2. DMAs
            if (latest.sma50 && close > latest.sma50) { checklist.priceAbove50DMA = true; score++; }
            if (latest.sma200 && close > latest.sma200) { checklist.priceAbove200DMA = true; score++; }

            // 3. Near 52-week high
            if (latest.high52w && close >= latest.high52w * 0.90) { checklist.near52WHigh = true; score++; }

            // 4. RS Strong (using absolute 20-day return > 2% as proxy since we don't have Nifty history inline here easily)
            const close20DaysAgo = priceDocs[dayIdx + 20].close;
            if ((close / close20DaysAgo) > 1.02) { checklist.rsStrong = true; score++; }

            // 5. OBV Rising
            if (latest.obv > priceDocs[dayIdx + 5].obv) { checklist.obvRising = true; score++; }

            // 6. CMF Positive
            if (latest.cmf && latest.cmf > 0) { checklist.cmfPositive = true; score++; }

            // 7. Delivery Increasing
            const currentDelivery = latest.deliveryPct || 0;
            let avgDelivPrev5 = 0;
            for (let i = dayIdx + 1; i <= dayIdx + 5; i++) {
                avgDelivPrev5 += (priceDocs[i].deliveryPct || 0);
            }
            avgDelivPrev5 /= 5;
            if (currentDelivery > avgDelivPrev5 && currentDelivery > 0) { 
                checklist.deliveryIncreasing = true; score++; 
            }

            // 8. Volume Drying in Base
            let avgVol5 = 0, avgVol15 = 0;
            for (let i = dayIdx + 1; i <= dayIdx + 5; i++) avgVol5 += priceDocs[i].volume;
            avgVol5 /= 5;
            for (let i = dayIdx + 6; i <= dayIdx + 20; i++) avgVol15 += priceDocs[i].volume;
            avgVol15 /= 15;
            if (avgVol5 < avgVol15) { checklist.volumeDrying = true; score++; }

            // 9. Breakout Volume
            const avgVol20 = (avgVol5 * 5 + avgVol15 * 15) / 20;
            if (latest.volume > 1.5 * avgVol20) { checklist.breakoutVolume = true; score++; }

            // Track if score >= 7 (since max is 9 without Sector Strong)
            if (score >= 7) {
                if (!resultsByDate[dateStr]) resultsByDate[dateStr] = [];
                resultsByDate[dateStr].push({ symbol, score, close, checklist });
            }
        }
    }

    // Sort dates descending
    const sortedDates = Object.keys(resultsByDate).sort((a, b) => new Date(b) - new Date(a));
    
    // Generate Markdown
    let md = `# Historical Momentum Backtest (Last 60 Trading Days)\n\n`;
    md += `*Note: Sector Strong (Point 10) is omitted from this historical script because it requires complex daily historical sector rotation calculations. The scores below are out of 9.*\n\n`;
    md += `**Filter Criteria:** Score >= 7 out of 9 points.\n\n`;

    for (const date of sortedDates) {
        md += `## Date: ${date}\n`;
        const hits = resultsByDate[date].sort((a, b) => b.score - a.score);
        if (hits.length === 0) {
            md += `*No stocks passed the criteria on this date.*\n\n`;
            continue;
        }

        md += `| Symbol | Close Price | Score | Key Triggers |\n`;
        md += `|---|---|---|---|\n`;

        for (const hit of hits) {
            const triggers = [];
            if (hit.checklist.breakoutVolume) triggers.push("Breakout Vol");
            if (hit.checklist.volumeDrying) triggers.push("Vol Drying");
            if (hit.checklist.priceAbove200DMA) triggers.push("200 DMA");
            if (hit.checklist.near52WHigh) triggers.push("Near 52W High");
            
            md += `| **${hit.symbol}** | ₹${hit.close.toFixed(2)} | **${hit.score}/9** | ${triggers.join(', ')} |\n`;
        }
        md += `\n`;
    }

    const outputPath = 'C:/Users/acer/.gemini/antigravity/brain/acd18615-bdb5-4520-bbd1-6cac68a39fd1/backtest_results.md';
    fs.writeFileSync(outputPath, md);
    console.log(`\nBacktest complete! Results saved to ${outputPath}`);
    process.exit(0);
}

run();
