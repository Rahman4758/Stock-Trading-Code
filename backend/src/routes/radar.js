const express = require('express');
const router = express.Router();
const ActiveRadar = require('../models/ActiveRadar');
const { redisClient } = require('../config/db');

// GET /api/v1/radar/active
// Returns top high conviction stocks currently in the 15-day lifecycle
router.get('/active', async (req, res) => {
    try {
        const cached = await redisClient.get('radar:active');
        if (cached) return res.json(JSON.parse(cached));

        const radar = await ActiveRadar.find({ status: 'TRACKING' })
            .sort({ highestScore: -1 }) // Best performing first
            .lean();
        
        // Background cache
        try { await redisClient.setEx('radar:active', 300, JSON.stringify(radar)); } catch {}

        res.json(radar);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch active radar log' });
    }
});

// GET /api/v1/radar/history
// Returns all past setups and why they successfully broke out or hit stoploss
router.get('/history', async (req, res) => {
    try {
        const cached = await redisClient.get('radar:history');
        if (cached) return res.json(JSON.parse(cached));

        const history = await ActiveRadar.find({ status: { $ne: 'TRACKING' } })
            .sort({ exitDate: -1 })
            .limit(100) // Keep it manageable
            .lean();
            
        try { await redisClient.setEx('radar:history', 300, JSON.stringify(history)); } catch {}

        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch historic radar log' });
    }
});

// GET /api/v1/radar/events
// Returns upcoming corporate events with their 15-day DailySnapshots history
router.get('/events', async (req, res) => {
    try {
        const EventCalendar = require('../models/EventCalendar');
        const DailySnapshot = require('../models/DailySnapshot');
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const events = await EventCalendar.find({ event_date: { $gte: today }, is_active_monitoring: true })
            .sort({ event_date: 1 })
            .lean();
            
        const results = [];
        for (let evt of events) {
            const snapshots = await DailySnapshot.find({ symbol: evt.symbol })
                .sort({ date: -1 })
                .limit(15)
                .lean();
                
            results.push({
                id: evt._id,
                symbol: evt.symbol,
                name: evt.company_name,
                sector: evt.sector,
                event: evt.event_type,
                eventDate: evt.event_date,
                exchange: 'NSE', // Defaults to NSE for now
                snapshots: snapshots.reverse() // ordered oldest to latest
            });
        }
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch event radar data' });
    }
});

module.exports = router;
