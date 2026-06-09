const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const StockSelector = require('../core/stockSelector');
const DailyPrice = require('../models/DailyPrice');
const SmartMoneyScore = require('../models/SmartMoneyScore');
const accumulationAnalyzer = require('../services/accumulationAnalyzer');

// GET /api/v1/portfolio
router.get('/', async (req, res) => {
    try {
        const items = await Portfolio.find().sort({ createdAt: -1 }).lean();

        // Fetch latest known date
        const latestPrice = await DailyPrice.findOne().sort({ date: -1 }).lean();
        const targetDate = latestPrice ? latestPrice.date : new Date();

        const results = await Promise.all(
            items.map(async (item) => {
                try {
                    // Get latest score
                    const score = await SmartMoneyScore.findOne({ symbol: item.symbol, date: targetDate }).lean();
                    const price = await DailyPrice.findOne({ symbol: item.symbol, date: targetDate }).lean();

                    return {
                        ...item,
                        currentPrice: price ? price.close : 0,
                        analysis: score ? {
                            compositeScore: score.compositeScore,
                            recommendation: score.interpretation,
                            scores: score.scores
                        } : null
                    };
                } catch {
                    return { ...item, analysis: null };
                }
            })
        );

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

// GET /api/v1/portfolio/:id/daily-update
router.get('/:id/daily-update', async (req, res) => {
    try {
        const item = await Portfolio.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ error: 'Portfolio item not found' });

        // Run fresh mini-analysis for today's data (fetch latest score instead of running scan)
        let analysis;
        try {
            analysis = await SmartMoneyScore.findOne({ symbol: item.symbol }).sort({ date: -1 }).lean();
            if (!analysis) throw new Error('No score found');
            
            // Map db fields to expected analysis fields
            analysis.currentPrice = (await DailyPrice.findOne({ symbol: item.symbol }).sort({ date: -1 }).lean())?.close || item.buyPrice || 0;
        } catch (err) {
            console.error(`Analysis fetch failed for ${item.symbol}:`, err.message);
            // Fallback for missing data
            return res.json({
                symbol: item.symbol,
                currentPrice: item.buyPrice || 0,
                pnl: 0,
                pnlPct: 0,
                stopLoss: null,
                targetPrice: null,
                recommendation: 'WAITING FOR DATA',
                score: 0,
            });
        }

        let portfolioAction = 'HOLD';
        const pnl = analysis.currentPrice - (item.buyPrice || analysis.currentPrice);
        const pnlPct = item.buyPrice ? (pnl / item.buyPrice) * 100 : 0;

        const sl = analysis.levels?.stopLoss;
        const t1 = analysis.levels?.target1;

        if (sl && analysis.currentPrice <= sl) portfolioAction = 'EXIT - SL Hit';
        else if (t1 && analysis.currentPrice >= t1) portfolioAction = 'BOOK PARTIAL - Target Hit';
        else if (analysis.institutionalScore < 40) portfolioAction = 'EXIT - Distribution detected';

        res.json({
            symbol: item.symbol,
            currentPrice: analysis.currentPrice,
            pnl: parseFloat(pnl.toFixed(2)),
            pnlPct: parseFloat(pnlPct.toFixed(2)),
            stopLoss: sl || null,
            targetPrice: t1 || null,
            recommendation: portfolioAction,
            score: analysis.finalScore || analysis.institutionalScore,
            grade: analysis.grade,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch daily update' });
    }
});

// POST /api/v1/portfolio/track
router.post('/track', async (req, res) => {
    const { symbol, notes, buyPrice, quantity, target1, stopLoss, entryReason, trade_type } = req.body;
    if (!symbol) return res.status(400).json({ detail: 'symbol is required' });

    try {
        const existing = await Portfolio.findOne({ symbol: symbol.toUpperCase() });
        if (existing) return res.status(400).json({ detail: 'Stock already tracked' });

        // Generate dynamic alert price based on ATR SL logic if not provided
        let alertPrice = stopLoss || null;
        let t1 = target1 || null;
        if (buyPrice && !alertPrice) {
            const analysis = await SmartMoneyScore.findOne({ symbol: symbol.toUpperCase() }).sort({ date: -1 }).lean();
            alertPrice = analysis?.levels?.stopLoss || null;
            if (!t1) t1 = analysis?.levels?.target1 || null;
        }

        const isManualTrade = trade_type === 'MANUAL' && buyPrice > 0;

        const item = await Portfolio.create({
            symbol: symbol.toUpperCase(),
            notes,
            buyPrice,
            quantity,
            alertPrice: alertPrice,
            trade_type: trade_type || 'WATCHLIST',
            targetPrice: t1,
            stopLoss: alertPrice,
            entryReason: entryReason
        });

        if (isManualTrade) {
            const TradeJournal = require('../models/TradeJournal');
            await TradeJournal.create({
                symbol: symbol.toUpperCase(),
                sector: 'MANUAL_ENTRY',
                status: 'OPEN',
                entry_date: new Date(),
                entry_price: buyPrice,
                stop_loss: alertPrice,
                target1: t1,
                quantity: quantity || 1,
                capital_deployed: buyPrice * (quantity || 1),
                risk_amount: (buyPrice - (alertPrice || buyPrice)) * (quantity || 1),
                trade_type: 'MANUAL',
                strategy_name: 'MANUAL_DISCRETIONARY',
                entry_reason: entryReason || notes || 'Manual Trade Tracking'
            });
        }

        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const { GoogleGenerativeAI } = require('@google/generative-ai');

// GET /api/v1/portfolio/:symbol/deep-analysis
router.get('/:symbol/deep-analysis', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const portfolioItem = await Portfolio.findOne({ symbol }).lean();
        if (!portfolioItem) return res.status(404).json({ error: 'Not in portfolio' });

        const score = await SmartMoneyScore.findOne({ symbol }).sort({ date: -1 }).lean();
        const latestPrice = await DailyPrice.findOne({ symbol }).sort({ date: -1 }).lean();
        
        const currentPrice = latestPrice ? latestPrice.close : portfolioItem.buyPrice;
        
        let pnl = 0, pnlPct = 0;
        if (portfolioItem.buyPrice) {
            pnl = (currentPrice - portfolioItem.buyPrice) * (portfolioItem.quantity || 1);
            pnlPct = ((currentPrice - portfolioItem.buyPrice) / portfolioItem.buyPrice) * 100;
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        You are an elite Institutional Portfolio Manager and AI Trading Assistant.
        Analyze this active trade and give a clear HOLD, SELL, or ADJUST recommendation with reasons.
        Take into account technical scores, current PnL, and any real-world macroeconomic/sentiment context you know about the broader market or this stock.

        Trade Details:
        - Symbol: ${symbol}
        - Entry Price: ₹${portfolioItem.buyPrice || 'N/A'}
        - Current Price: ₹${currentPrice}
        - Current PnL: ${pnlPct.toFixed(2)}% (₹${pnl.toFixed(2)})
        - User Stop Loss: ₹${portfolioItem.stopLoss || 'None'}
        - User Target: ₹${portfolioItem.targetPrice || 'None'}
        - Entry Reason: ${portfolioItem.entryReason || 'N/A'}

        Technical Score Engine Snapshot:
        - Institutional Accumulation Score: ${score?.institutionalScore || 'N/A'} / 100
        - Technical Score: ${score?.technicalScore || 'N/A'} / 100
        - Final Grade: ${score?.grade || 'N/A'}
        - Current Status: ${score?.action || 'N/A'}

        Respond in markdown format. Be concise, professional, and actionable. If there is a sudden drop but it's just macro noise (e.g., rate cut fears, global news), mention it so the user doesn't panic sell. If the technicals are breaking, advise a strict exit.
        Format:
        ### Final Recommendation: [HOLD / SELL / ADJUST STOPLOSS]
        **Reasoning:** ...
        **Action Plan:** ...
        `;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            res.json({
                symbol,
                currentPrice,
                pnlPct,
                analysis: responseText
            });
        } catch (llmErr) {
            console.error("LLM Error:", llmErr);
            res.json({
                symbol,
                currentPrice,
                pnlPct,
                analysis: "### Final Recommendation: TECHNICAL FALLBACK\n\nLLM Analysis failed. Based on purely technical scores, the stock grade is **" + (score?.grade || "N/A") + "**. Stick to your hardcoded Stop Loss of ₹" + (portfolioItem.stopLoss || "N/A") + "."
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate deep analysis' });
    }
});

// GET /api/v1/portfolio/:symbol/holding-detail
router.get('/:symbol/holding-detail', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        
        const portfolioItem = await Portfolio.findOne({ symbol }).lean();
        if (!portfolioItem) return res.status(404).json({ error: 'Not in portfolio' });

        const TradeJournal = require('../models/TradeJournal');
        const activeTrade = await TradeJournal.findOne({ symbol, status: 'OPEN' }).sort({ createdAt: -1 }).lean();

        const score = await SmartMoneyScore.findOne({ symbol }).sort({ date: -1 }).lean();
        const latestPrice = await DailyPrice.findOne({ symbol }).sort({ date: -1 }).lean();
        
        const currentPrice = latestPrice ? latestPrice.close : (portfolioItem.buyPrice || 0);
        
        let pnl = 0, pnlPct = 0, invested = 0, currentValue = 0;
        if (portfolioItem.buyPrice && portfolioItem.quantity) {
            invested = portfolioItem.buyPrice * portfolioItem.quantity;
            currentValue = currentPrice * portfolioItem.quantity;
            pnl = currentValue - invested;
            pnlPct = ((currentPrice - portfolioItem.buyPrice) / portfolioItem.buyPrice) * 100;
        }

        res.json({
            portfolio: portfolioItem,
            journal: activeTrade || null,
            technical: score || null,
            market: {
                currentPrice,
                dayChangePct: latestPrice ? latestPrice.percentChange : 0
            },
            performance: {
                invested,
                currentValue,
                pnlAbsolute: pnl,
                pnlPct: pnlPct
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch holding details' });
    }
});

// DELETE /api/v1/portfolio/:symbol
router.delete('/:symbol', async (req, res) => {
    const item = await Portfolio.findOneAndDelete({ symbol: req.params.symbol.toUpperCase() });
    if (!item) return res.status(404).json({ detail: 'Stock not found in portfolio' });
    res.json(item);
});

// v2.0 Enterprise Features

// GET /api/v1/portfolio/exposure (Sector Limits & Capital Deployment)
router.get('/v2/exposure', async (req, res) => {
    try {
        const pm = require('../services/portfolioManager');
        const stats = await pm.calculateExposure();
        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch exposure stats' });
    }
});

// GET /api/v1/portfolio/v2/journal (Trade Log with PnL)
router.get('/v2/journal', async (req, res) => {
    try {
        const TradeJournal = require('../models/TradeJournal');
        const trades = await TradeJournal.find().sort({ createdAt: -1 }).lean();
        
        let winCount = 0;
        let lossCount = 0;
        let totalPnl = 0;
        let strategyStats = {};
        
        trades.forEach(t => {
            const strat = t.strategy_name || 'UNKNOWN';
            if (!strategyStats[strat]) {
                strategyStats[strat] = { wins: 0, losses: 0, pnl: 0, total: 0 };
            }
            
            if (t.status === 'CLOSED') {
                strategyStats[strat].total++;
                if (t.pnl_absolute > 0) {
                    winCount++;
                    strategyStats[strat].wins++;
                } else {
                    lossCount++;
                    strategyStats[strat].losses++;
                }
                totalPnl += (t.pnl_absolute || 0);
                strategyStats[strat].pnl += (t.pnl_absolute || 0);
            }
        });
        
        const winRate = (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : 0;
        
        Object.keys(strategyStats).forEach(strat => {
            const st = strategyStats[strat];
            st.winRate = st.total > 0 ? (st.wins / st.total) * 100 : 0;
        });

        res.json({
            summary: {
                total_trades: trades.length,
                win_rate_pct: winRate.toFixed(1),
                total_realized_pnl: totalPnl.toFixed(2),
                open_positions: trades.filter(t => t.status === 'OPEN').length
            },
            strategy_performance: strategyStats,
            history: trades
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch trade journal' });
    }
});

module.exports = router;
