const BaseCollector = require('./base');
const EventCalendar = require('../models/EventCalendar');
const Stock = require('../models/Stock');

/**
 * EventScanner Collector
 * Periodically hits NSE/BSE corporate announcements or a mock source
 * to maintain the future 20-30 day window of corporate events for tracked stocks.
 */
class EventScanner extends BaseCollector {
    constructor() {
        super({
            sourceName: 'CORPORATE_EVENTS',
            baseUrl: 'https://www.nseindia.com',
            rateLimitCalls: 5,
            rateLimitPeriod: 60000,
        });
    }

    /**
     * Parse events list mock/proxy logic
     * Replace with live API parsing as the platform matures.
     */
    async collect({ lookaheadDays = 30 } = {}) {
        console.log('[EventScanner] Initializing Deduplicated Deep-Scan...');
        
        try {
            await this.initCookies();
            
            const endpoints = [
                { url: '/api/event-calendar?index=equities', type: 'CALENDAR' },
                { url: '/api/corporate-board-meetings?index=equities', type: 'BOARD_MEETING' }
            ];

            const today = new Date();
            const futureLimit = new Date();
            futureLimit.setDate(today.getDate() + lookaheadDays);

            const IMPACT_KEYWORDS = {
                'Earnings': ['result', 'financial', 'earnings', 'quarterly'],
                'Board Meeting': ['board meeting', 'dividend', 'buyback', 'bonus', 'split', 'fund raising'],
                'AGM/EGM': ['agm', 'egm', 'meeting of shareholders'],
                'Analyst Day': ['analyst', 'investor meet', 'concall']
            };

            // Temporary store for deduplication
            // Key: SYMBOL_YYYY-MM-DD
            const eventMap = new Map();

            for (const endpoint of endpoints) {
                const response = await this.request('GET', endpoint.url);
                if (!response || !Array.isArray(response)) continue;

                for (const item of response) {
                    const symbol = item.symbol || item.bm_symbol;
                    const rawDate = item.date || item.bm_date;
                    const purpose = (item.purpose || item.bm_desc || '').toLowerCase();
                    
                    if (!symbol || !rawDate) continue;

                    // Filter for Top 60 Prime Universe
                    const stock = await Stock.findOne({ symbol, isFno: true }).select('companyName sector');
                    if (!stock) continue;

                    const eventDate = new Date(rawDate);
                    if (isNaN(eventDate.getTime())) continue;
                    if (eventDate < today || eventDate > futureLimit) continue;

                    let eventType = null;
                    for (const [type, keywords] of Object.entries(IMPACT_KEYWORDS)) {
                        if (keywords.some(k => purpose.includes(k))) {
                            eventType = type;
                            break;
                        }
                    }

                    if (!eventType) continue;

                    const dateKey = eventDate.toISOString().split('T')[0];
                    const uniqueKey = `${symbol}_${dateKey}`;

                    // DEDUPLICATION LOGIC:
                    // If we already have an event for this stock on this day, 
                    // we flag it as 'Multiple Events'.
                    if (eventMap.has(uniqueKey)) {
                        const existing = eventMap.get(uniqueKey);
                        existing.isMultiple = true;
                        // Still prefer Earnings for internal logic but we will label as Multiple
                        if (eventType === 'Earnings') existing.eventType = 'Earnings';
                    } else {
                        eventMap.set(uniqueKey, { symbol, eventDate, eventType, stock, item, isMultiple: false });
                    }
                }
            }

            // Sync Deduplicated Events to Database
            let savedCount = 0;
            // Clear current window to prevent "Zombie Duplicates" from previous messy runs
            await EventCalendar.deleteMany({ event_date: { $gte: today, $lte: futureLimit } });

            for (const entry of eventMap.values()) {
                await EventCalendar.create({
                    symbol: entry.symbol,
                    event_date: entry.eventDate,
                    event_type: entry.isMultiple ? 'Multiple Events' : entry.eventType,
                    company_name: entry.stock.companyName || entry.item.company || entry.item.sm_name || entry.symbol,
                    sector: entry.stock.sector || 'Unknown',
                    is_active_monitoring: true,
                    expected_impact: 'High',
                    description: entry.item.bm_desc || entry.item.purpose
                });
                savedCount++;
            }

            console.log(`[EventScanner] Deduplicated Sync Complete. Registered ${savedCount} unique high-impact events.`);
            return { saved: savedCount };

        } catch (err) {
            console.error(`[EventScanner] Deduplicated Sync failed: ${err.message}`);
            return { error: err.message, saved: 0 };
        }
    }
}

module.exports = EventScanner;
