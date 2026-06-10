/**
 * SwingScanner.js
 *
 * 3-Layer Federal Bank Swing Trade Scanner
 *
 * Layer 1: Fast MongoDB pre-filter (500 → ~80 stocks, ~5 seconds)
 * Layer 2: Deep algorithmic scoring using existing services (~80 → ~20 stocks, ~60 seconds)
 * Layer 3: Federal Bank LLM Agent on top candidates (~20 stocks, ~3-5 minutes)
 * Layer 4: Daily portfolio tracking cron for owned stocks
 */

const DailyPrice      = require('../models/DailyPrice');
const OiData          = require('../models/OiData');
const SwingScanResult = require('../models/SwingScanResult');
const Watchlist       = require('../models/Watchlist');
const SectorStock     = require('../models/SectorStock');
const convictionService      = require('./ConvictionService');
const sectorRotationAnalyzer = require('./sectorRotationAnalyzer');
const llmService             = require('./LLMService');

class SwingScanner {

    // ─────────────────────────────────────────────
    // LAYER 1 — FAST DB PRE-FILTER
    // ─────────────────────────────────────────────
    async layer1Filter() {
        console.log('[SwingScanner] Layer 1: Running fast DB pre-filter...');

        // Get the latest trading date we have data for
        const latestDoc = await DailyPrice.findOne().sort({ date: -1 }).select('date').lean();
        if (!latestDoc) return [];
        const latestDate = latestDoc.date;

        // Get all stocks with latest day data matching basic criteria
        const candidates = await DailyPrice.find({
            date: latestDate,
            close:       { $gte: 50 },             // Min price ₹50
            deliveryPct: { $gte: 38 },              // Min delivery
            rsi14:       { $gte: 38, $lte: 78 },   // Not overbought/oversold
            $expr: {
                $and: [
                    { $gte: ['$close', '$sma200'] },                       // Above 200 SMA
                    { $gte: ['$close', { $multiply: ['$sma50', 0.97] }] }, // Within 3% of 50 SMA
                    { $gte: ['$rsVsNifty', -1] }                           // RS not deeply negative
                ]
            }
        }).select('symbol close sma50 sma200 rsi14 deliveryPct rsVsNifty high52w volume').lean();

        // Also match OI signal — exclude bearish OI
        const symbols = candidates.map(c => c.symbol);
        const latestOi = await OiData.find({
            symbol: { $in: symbols },
            oiSignal: { $in: ['LONG_BUILDUP', 'SHORT_COVERING', 'NEUTRAL'] }
        }).sort({ date: -1 }).select('symbol oiSignal futureOi pcr').lean();

        const oiOkSymbols = new Set(latestOi.map(o => o.symbol));
        const oiMap = {};
        latestOi.forEach(o => { if (!oiMap[o.symbol]) oiMap[o.symbol] = o; });

        const passed = candidates.filter(c => oiOkSymbols.has(c.symbol));
        console.log(`[SwingScanner] Layer 1: ${candidates.length} candidates → ${passed.length} passed`);
        return { passed, oiMap, latestDate };
    }

    // ─────────────────────────────────────────────
    // LAYER 2 — DEEP ALGORITHMIC SCAN
    // ─────────────────────────────────────────────
    async layer2AlgoScan(layer1Result) {
        const { passed, oiMap, latestDate } = layer1Result;
        console.log(`[SwingScanner] Layer 2: Running algo scan on ${passed.length} stocks...`);

        const qualifiedStocks = [];

        for (const stock of passed) {
            try {
                const sym = stock.symbol;

                // Fetch recent price history (60 days)
                const prices = await DailyPrice.find({ symbol: sym })
                    .sort({ date: -1 }).limit(60).lean();
                if (prices.length < 21) continue;

                // Fetch recent OI history
                const oiDocs = await OiData.find({ symbol: sym })
                    .sort({ date: -1 }).limit(10).lean();

                const latest = prices[0];

                // ── Delivery trend check ─────────────────────────────
                const del5  = prices.slice(0, 5).map(p => p.deliveryPct || 0);
                const del10 = prices.slice(0, 10).map(p => p.deliveryPct || 0);
                const del5Rising  = del5[0] > del5[del5.length - 1];
                const del10Rising = del10[0] > del10[del10.length - 1];

                // ── Volume analysis ──────────────────────────────────
                const vol20 = prices.slice(0, 20).reduce((s, p) => s + (p.volume || 0), 0) / 20;
                const volumeVsAvg = (latest.volume || 0) / (vol20 || 1);

                // Volume contracting in base (last 15 days vs prior 15 days)
                const recentVol  = prices.slice(0, 15).reduce((s, p) => s + (p.volume || 0), 0) / 15;
                const priorVol   = prices.slice(15, 30).reduce((s, p) => s + (p.volume || 0), 0) / 15;
                const volContracting = recentVol < priorVol * 0.9;

                // Distribution days (high vol down days in last 15 sessions)
                const distDays = prices.slice(0, 15).filter(p =>
                    p.close < p.open && (p.volume || 0) > vol20 * 1.3
                ).length;
                if (distDays >= 3) continue; // Too much distribution — skip

                // ── Higher lows check ────────────────────────────────
                const lows10 = prices.slice(0, 10).map(p => p.low);
                const higherLows = lows10.every((l, i) => i === 0 || l >= lows10[i - 1] * 0.995);

                // ── Weeks in base (sideways consolidation) ───────────
                const high20 = Math.max(...prices.slice(0, 20).map(p => p.high));
                const low20  = Math.min(...prices.slice(0, 20).map(p => p.low));
                const priceRange20Pct = ((high20 - low20) / low20) * 100;
                const inBase = priceRange20Pct < 12; // Less than 12% range = consolidating
                const weeksInBase = inBase ? Math.floor(prices.slice(0, 20).length / 5) : 0;

                // ── OI / PCR analysis ─────────────────────────────────
                const latestOiDoc = oiDocs[0] || {};
                const prevOiDoc   = oiDocs[1] || {};
                const pcr = latestOiDoc.pcr || 0;
                const pcrPrev = prevOiDoc.pcr || 0;
                const pcrTrend = pcr > pcrPrev ? 'IMPROVING' : pcr < pcrPrev ? 'DETERIORATING' : 'STABLE';
                const futureOiChange3d = (oiDocs.length >= 2 && oiDocs[2]?.futureOi)
                    ? ((latestOiDoc.futureOi - oiDocs[2].futureOi) / oiDocs[2].futureOi * 100)
                    : 0;

                // ── Relative strength vs sector ───────────────────────
                const sectorDoc = await SectorStock.findOne({ symbol: sym }).lean();
                const rsVsSector5d = latest.rsVsNifty || 0; // approximation

                // ── Conviction score ─────────────────────────────────
                const convResult = await convictionService.compute(sym, 20, null, prices, false);
                const convictionScore = convResult?.compositeScore || 0;
                if (convictionScore < 50) continue; // Minimum institutional interest

                // ── Near 52W high ────────────────────────────────────
                const high52w = latest.high52w || Math.max(...prices.map(p => p.high));
                const distTo52wHighPct = ((high52w - latest.close) / high52w) * 100;
                const near52wHigh = distTo52wHighPct <= 8;

                // ── Support / Resistance ─────────────────────────────
                const support = {
                    level1: latest.sma50 || (latest.close * 0.95),
                    level2: low20
                };
                const resistance = {
                    level1: high20,
                    level2: high52w
                };

                // ── Algo score (Layer 2 quick score) ─────────────────
                let algoScore = 0;
                if (latest.close >= latest.sma200) algoScore += 15;
                if (latest.close >= latest.sma50)  algoScore += 10;
                if (higherLows)                    algoScore += 10;
                if (near52wHigh)                   algoScore += 10;
                if (latest.deliveryPct >= 45)      algoScore += 10;
                if (del5Rising)                    algoScore += 8;
                if (del10Rising)                   algoScore += 6;
                if (volContracting)                algoScore += 8;
                if (distDays === 0)                algoScore += 5;
                if (pcr >= 1.0)                    algoScore += 8;
                if (pcrTrend === 'IMPROVING')       algoScore += 5;
                if ((latest.rsVsNifty || 0) >= 0)  algoScore += 5;
                if (convictionScore >= 70)          algoScore += 10;
                if (inBase)                         algoScore += 5;

                // Only proceed to LLM if algo score >= 60
                if (algoScore < 60) continue;

                // ── Delivery rising on weak days check ──────────────
                const weakDays = prices.slice(0, 5).filter(p => p.close <= p.open);
                const deliveryRisingOnWeakDays = weakDays.some(p => p.deliveryPct >= 50);

                qualifiedStocks.push({
                    symbol: sym,
                    algoScore,
                    currentPrice:  latest.close,
                    price200emaDiff: latest.sma200 ? ((latest.close - latest.sma200) / latest.sma200) * 100 : 0,
                    price50emaDiff:  latest.sma50  ? ((latest.close - latest.sma50)  / latest.sma50)  * 100 : 0,
                    rsi14: latest.rsi14,
                    higherLows,
                    near52wHigh,
                    distTo52wHighPct,
                    weeksInBase,
                    inBase,
                    deliveryPct: latest.deliveryPct,
                    deliveryTrend5d:  del5Rising  ? 'RISING' : 'FLAT',
                    deliveryTrend10d: del10Rising ? 'RISING' : 'FLAT',
                    deliveryRisingOnWeakDays,
                    volumeVsAvg,
                    baseVolumePattern: volContracting ? 'CONTRACTING' : 'EXPANDING',
                    distributionDays: distDays,
                    pcr,
                    pcrTrend,
                    oiSignal: latestOiDoc.oiSignal || 'NEUTRAL',
                    putWritingLevel: support.level1,
                    callWritingLevel: resistance.level1,
                    futureOiChange3d,
                    rsVsNifty10d: latest.rsVsNifty || 0,
                    rsVsSector5d,
                    convictionScore,
                    support,
                    resistance,
                    high52w,
                    sector: sectorDoc?.sector || 'Unknown',
                    prices,
                    latestDate
                });

            } catch (err) {
                console.error(`[SwingScanner] Layer 2 error for ${stock.symbol}: ${err.message}`);
            }
        }

        // Sort by algo score descending, take top 25
        qualifiedStocks.sort((a, b) => b.algoScore - a.algoScore);
        const top = qualifiedStocks.slice(0, 25);
        console.log(`[SwingScanner] Layer 2: ${passed.length} → ${top.length} top candidates`);
        return top;
    }

    // ─────────────────────────────────────────────
    // LAYER 3 — FEDERAL BANK LLM AGENT
    // ─────────────────────────────────────────────
    async layer3LlmAgent(candidates, scanDate) {
        console.log(`[SwingScanner] Layer 3: Running Federal Bank LLM on ${candidates.length} stocks...`);
        const results = [];

        // Get portfolio stocks for context
        const portfolioStocks = await Watchlist.find({ isActive: true, isOwned: true }).lean();
        const portfolioSymbols = new Set(portfolioStocks.map(p => p.symbol));
        const portfolioMap = {};
        portfolioStocks.forEach(p => { portfolioMap[p.symbol] = p; });

        for (const stock of candidates) {
            try {
                console.log(`[SwingScanner] LLM analyzing ${stock.symbol}...`);
                const llmResult = await llmService.federalBankAnalyze(stock.symbol, stock);

                if (!llmResult.success) {
                    console.warn(`[SwingScanner] LLM failed for ${stock.symbol}: ${llmResult.error}`);
                    continue;
                }

                const d = llmResult.data;
                const isPortfolio = portfolioSymbols.has(stock.symbol);
                const portfolioMeta = isPortfolio ? portfolioMap[stock.symbol] : null;
                const currentPnl = isPortfolio && portfolioMeta?.buyPrice && portfolioMeta?.quantity
                    ? (stock.currentPrice - portfolioMeta.buyPrice) * portfolioMeta.quantity : null;
                const currentPnlPct = isPortfolio && portfolioMeta?.buyPrice
                    ? ((stock.currentPrice - portfolioMeta.buyPrice) / portfolioMeta.buyPrice) * 100 : null;

                // Save to DB
                const record = await SwingScanResult.findOneAndUpdate(
                    { symbol: stock.symbol, date: scanDate },
                    {
                        symbol: stock.symbol,
                        date: scanDate,
                        swingScore: d.swingScore || 0,
                        scoreBreakdown: d.scoreBreakdown || {},
                        stage: d.stage || 'Unknown',
                        federalBankSimilarity: d.federalBankSimilarity || 0,
                        action: d.action || 'AVOID',
                        entryType: d.entryType || 'NONE',
                        confidence: d.confidence || 'LOW',
                        entryZone: d.entryZone,
                        stopLoss: d.stopLoss,
                        target1: d.target1,
                        target2: d.target2,
                        target3: d.target3,
                        rrRatio: d.rrRatio,
                        holdingPeriodDays: d.holdingPeriodDays,
                        smartMoneySignal: d.smartMoneySignal || 'NEUTRAL',
                        institutionalActivity: d.institutionalActivity || 'NEUTRAL',
                        optionTrapAlert: d.optionTrapAlert || false,
                        rsVsNifty: d.rsVsNifty || 'UNDERPERFORMING',
                        rsVsSector: d.rsVsSector || 'UNDERPERFORMING',
                        currentPrice: stock.currentPrice,
                        deliveryPct: stock.deliveryPct,
                        deliveryTrend5d: stock.deliveryTrend5d,
                        deliveryTrend10d: stock.deliveryTrend10d,
                        oiSignal: stock.oiSignal,
                        pcr: stock.pcr,
                        pcrTrend: stock.pcrTrend,
                        support: stock.support?.level1,
                        resistance: stock.resistance?.level1,
                        high52w: stock.high52w,
                        mostImportantReason: d.mostImportantReason || '',
                        redFlags: d.redFlags || '',
                        llmReport: d.llmReport || '',
                        isPortfolioStock: isPortfolio,
                        portfolioMeta: isPortfolio ? {
                            buyPrice: portfolioMeta?.buyPrice,
                            quantity: portfolioMeta?.quantity,
                            currentPnl,
                            currentPnlPct
                        } : undefined,
                        layer1Pass: true,
                        layer2Pass: true,
                        layer2Score: stock.algoScore,
                        trend: d.trend || 'NEUTRAL',
                    },
                    { upsert: true, new: true }
                );

                results.push(record);

                // Rate limit: 1 second between LLM calls
                await new Promise(r => setTimeout(r, 1200));

            } catch (err) {
                console.error(`[SwingScanner] Layer 3 error for ${stock.symbol}: ${err.message}`);
            }
        }

        console.log(`[SwingScanner] Layer 3 complete. ${results.length} stocks analyzed.`);
        return results;
    }

    // ─────────────────────────────────────────────
    // MAIN — Run full scan
    // ─────────────────────────────────────────────
    async runFullScan() {
        console.log('[SwingScanner] ════ Starting Federal Bank Swing Scan ════');
        const startTime = Date.now();

        const layer1Result = await this.layer1Filter();
        if (!layer1Result.passed || layer1Result.passed.length === 0) {
            return { success: false, error: 'Layer 1 returned no candidates' };
        }

        const layer2Candidates = await this.layer2AlgoScan(layer1Result);
        if (layer2Candidates.length === 0) {
            return { success: false, error: 'Layer 2 returned no qualified stocks' };
        }

        const scanDate = layer1Result.latestDate;
        const results = await this.layer3LlmAgent(layer2Candidates, scanDate);

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[SwingScanner] ════ Scan Complete in ${elapsed}s. ${results.length} results saved. ════`);

        return {
            success: true,
            totalScanned: layer1Result.passed.length,
            layer2Qualified: layer2Candidates.length,
            finalResults: results.length,
            elapsedSeconds: elapsed,
            scanDate
        };
    }

    // ─────────────────────────────────────────────
    // LAYER 4 — PORTFOLIO DAILY TRACKING
    // ─────────────────────────────────────────────
    async trackPortfolioStocks() {
        console.log('[SwingScanner] Layer 4: Running portfolio tracking update...');
        const portfolioStocks = await Watchlist.find({ isActive: true, isOwned: true }).lean();
        if (!portfolioStocks.length) return { updated: 0 };

        const symbols = portfolioStocks.map(p => p.symbol);
        const portfolioMap = {};
        portfolioStocks.forEach(p => { portfolioMap[p.symbol] = p; });

        const latestDate = (await DailyPrice.findOne().sort({ date: -1 }).select('date').lean())?.date;
        if (!latestDate) return { updated: 0 };

        let updated = 0;
        for (const sym of symbols) {
            try {
                const prices = await DailyPrice.find({ symbol: sym }).sort({ date: -1 }).limit(30).lean();
                if (prices.length < 5) continue;

                const latest   = prices[0];
                const oiDoc    = await OiData.findOne({ symbol: sym }).sort({ date: -1 }).lean();

                // Find the existing scan result
                let scanResult = await SwingScanResult.findOne({ symbol: sym }).sort({ date: -1 });
                if (!scanResult) {
                    // If no existing scan result, create a minimal one
                    scanResult = new SwingScanResult({ symbol: sym, date: latestDate, isPortfolioStock: true });
                }

                // Compute quick daily update fields
                const del5 = prices.slice(0, 5).map(p => p.deliveryPct || 0);
                const del5Rising = del5[0] > del5[del5.length - 1];
                const today = new Date();

                const pm = portfolioMap[sym];
                const currentPnl = pm?.buyPrice && pm?.quantity
                    ? (latest.close - pm.buyPrice) * pm.quantity : null;
                const currentPnlPct = pm?.buyPrice
                    ? ((latest.close - pm.buyPrice) / pm.buyPrice) * 100 : null;

                // Detect exit signals
                const exitSignals = [];
                if (latest.sma50 && latest.close < latest.sma50) exitSignals.push('CLOSE BELOW 50 EMA');
                if (oiDoc?.oiSignal === 'LONG_UNWINDING')         exitSignals.push('LONG UNWINDING');
                if (scanResult.stopLoss && latest.close < scanResult.stopLoss) exitSignals.push('STOP LOSS HIT');

                const keyDevelopment = exitSignals.length > 0
                    ? `⚠️ EXIT SIGNAL: ${exitSignals.join(', ')}`
                    : del5Rising
                        ? 'Delivery trend rising — accumulation continuing'
                        : 'No major change';

                // Add to tracking history
                const trackEntry = {
                    date: today,
                    swingScore: scanResult.swingScore,
                    stage: scanResult.stage,
                    deliveryPct: latest.deliveryPct,
                    oiSignal: oiDoc?.oiSignal || 'N/A',
                    keyDevelopment,
                    action: exitSignals.length > 0 ? 'DOWNGRADE TO AVOID' : 'STILL WATCHING',
                };

                scanResult.trackingHistory = [trackEntry, ...(scanResult.trackingHistory || [])].slice(0, 30);
                scanResult.currentPrice = latest.close;
                scanResult.deliveryPct  = latest.deliveryPct;
                scanResult.oiSignal     = oiDoc?.oiSignal || 'N/A';
                scanResult.isPortfolioStock = true;
                scanResult.portfolioMeta = { buyPrice: pm?.buyPrice, quantity: pm?.quantity, currentPnl, currentPnlPct };
                await scanResult.save();
                updated++;
            } catch (err) {
                console.error(`[SwingScanner] Portfolio tracking error for ${sym}: ${err.message}`);
            }
        }

        console.log(`[SwingScanner] Portfolio tracking updated ${updated} stocks.`);
        return { updated };
    }
}

module.exports = new SwingScanner();
