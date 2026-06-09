const express = require('express');
const router = express.Router();
const Watchlist = require('../models/Watchlist');
const WatchlistAnalysis = require('../models/WatchlistAnalysis');
const Stock = require('../models/Stock');
const watchlistAnalyzer = require('../services/WatchlistAnalyzer');
const llmService = require('../services/LLMService');

// GET /api/v1/watchlist/search — Search active stocks
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json({ success: true, data: [] });
        
        const regex = new RegExp(q, 'i');
        const stocks = await Stock.find({ 
            isActive: true, 
            $or: [{ symbol: regex }, { name: regex }] 
        }).limit(10).select('symbol name sector').lean();
        
        res.json({ success: true, data: stocks });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/watchlist — List all watchlisted stocks with latest analysis
router.get('/', async (req, res) => {
    const items = await Watchlist.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    
    // Enrich with latest analysis
    const enriched = await Promise.all(items.map(async (item) => {
        const analysis = await WatchlistAnalysis.findOne({ symbol: item.symbol }).lean();
        return { ...item, analysis: analysis || null };
    }));
    
    res.json({ success: true, count: enriched.length, data: enriched });
});

// POST /api/v1/watchlist/add — Add stock to watchlist
router.post('/add', async (req, res) => {
    const { symbol, addedFrom, category, notes, isOwned, buyPrice, sellPrice, stopLoss, quantity, buyDate } = req.body;
    if (!symbol) return res.status(400).json({ success: false, error: 'Symbol is required' });
    
    // Fetch company name
    const stock = await Stock.findOne({ symbol: symbol.toUpperCase() }).lean();
    const companyName = stock ? stock.name : '';

    const existing = await Watchlist.findOne({ symbol: symbol.toUpperCase() });
    if (existing) {
        // Reactivate if was deactivated
        existing.isActive = true;
        if (addedFrom) existing.addedFrom = addedFrom;
        if (category) existing.category = category;
        if (notes) existing.notes = notes;
        if (isOwned !== undefined) existing.isOwned = isOwned;
        if (buyPrice !== undefined) existing.buyPrice = buyPrice;
        if (sellPrice !== undefined) existing.sellPrice = sellPrice;
        if (stopLoss !== undefined) existing.stopLoss = stopLoss;
        if (quantity !== undefined) existing.quantity = quantity;
        if (buyDate !== undefined) existing.buyDate = new Date(buyDate);
        if (companyName && !existing.companyName) existing.companyName = companyName;
        
        await existing.save();
        return res.json({ success: true, data: existing, message: 'Already in watchlist, updated.' });
    }
    
    const item = await Watchlist.create({
        symbol: symbol.toUpperCase(),
        companyName,
        addedFrom: addedFrom || 'MANUAL',
        category: category || 'General',
        notes: notes || '',
        isOwned: isOwned || false,
        buyPrice: buyPrice || null,
        sellPrice: sellPrice || null,
        stopLoss: stopLoss || null,
        quantity: quantity || null,
        buyDate: buyDate ? new Date(buyDate) : null
    });
    
    // Trigger analysis immediately for the new stock
    watchlistAnalyzer.analyzeStock(symbol).catch(err => {
        console.error(`[Watchlist] Background analysis failed for ${symbol}:`, err.message);
    });
    
    res.status(201).json({ success: true, data: item, message: 'Added to watchlist. Analysis running...' });
});

// DELETE /api/v1/watchlist/:symbol — Remove from watchlist
router.delete('/:symbol', async (req, res) => {
    const { symbol } = req.params;
    await Watchlist.findOneAndUpdate({ symbol: symbol.toUpperCase() }, { isActive: false });
    res.json({ success: true, message: `${symbol} removed from watchlist.` });
});

// GET /api/v1/watchlist/:symbol/analysis — Get detailed analysis for one stock
router.get('/:symbol/analysis', async (req, res) => {
    const { symbol } = req.params;
    
    // Try to get stored analysis, or compute fresh
    let analysis = await WatchlistAnalysis.findOne({ symbol: symbol.toUpperCase() }).lean();
    
    if (!analysis) {
        analysis = await watchlistAnalyzer.analyzeStock(symbol);
    }
    
    res.json({ success: true, data: analysis });
});

// POST /api/v1/watchlist/analyze-all — Trigger fresh analysis for all watchlisted stocks
router.post('/analyze-all', async (req, res) => {
    const results = await watchlistAnalyzer.analyzeAll();
    res.json({ success: true, count: results.length, message: `Analyzed ${results.length} stocks.` });
});

// POST /api/v1/watchlist/:symbol/analyze — Trigger fresh analysis for a specific stock
router.post('/:symbol/analyze', async (req, res) => {
    const { symbol } = req.params;
    const analysis = await watchlistAnalyzer.analyzeStock(symbol);
    if (!analysis) {
        return res.status(400).json({ success: false, error: 'Failed to analyze stock. Insufficient data.' });
    }
    res.json({ success: true, data: analysis, message: `Analyzed ${symbol}.` });
});

// POST /api/v1/watchlist/:symbol/chat — Chat with the AI about a specific stock
router.post('/:symbol/chat', async (req, res) => {
    const { symbol } = req.params;
    const { message } = req.body;
    
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });
    
    const analysis = await WatchlistAnalysis.findOne({ symbol: symbol.toUpperCase() }).lean();
    if (!analysis || !analysis.aiDetailedAnalysis) {
        return res.status(400).json({ success: false, error: 'No previous AI analysis found to contextualize the chat.' });
    }
    
    const result = await llmService.chatWithStock(symbol.toUpperCase(), analysis.aiDetailedAnalysis, message);
    res.json(result);
});

// PATCH /api/v1/watchlist/:symbol — Update category/notes
router.patch('/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { category, notes } = req.body;
    
    const updates = {};
    if (category !== undefined) updates.category = category;
    if (notes !== undefined) updates.notes = notes;
    
    const item = await Watchlist.findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        updates,
        { new: true }
    );
    
    if (!item) return res.status(404).json({ success: false, error: 'Not found in watchlist' });
    res.json({ success: true, data: item });
});

module.exports = router;
