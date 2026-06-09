/**
 * Bhav Copy Collector
 * Fetches NSE daily price + delivery data after market close
 * Source: NSE public CSV/API — no authentication required
 */
const BaseCollector = require('./base');
const DailyPrice = require('../models/DailyPrice');
const Stock = require('../models/Stock');

class BhavCopyCollector extends BaseCollector {
    constructor() {
        super({
            sourceName: 'NSE_BHAV',
            baseUrl: 'https://www.nseindia.com',
            rateLimitCalls: 5,
            rateLimitPeriod: 60000,
        });
    }

    /**
     * Fetch OHLCV data for a single symbol using NSE quote API
     */
    async fetchQuote(symbol) {
        try {
            const data = await this.request('GET', '/api/quote-equity', { symbol });
            const pd = data.priceInfo;
            const dp = data.securityWiseDP || {};

            if (!pd) return null;

            return {
                open: pd.open || 0,
                high: pd.weekHighLow?.max || pd.high || 0,
                low: pd.weekHighLow?.min || pd.low || 0,
                close: pd.lastPrice || 0,
                prevClose: pd.previousClose || 0,
                deliveryQty: dp.deliveryQuantity || 0,
                deliveryPct: parseFloat(dp.deliveryToTradedQuantity) || 0,
                volume: dp.quantityTraded || 0,
            };
        } catch (err) {
            console.debug(`[BhavCopy] No quote data for ${symbol}: ${err.message}`);
            return null;
        }
    }

    /**
     * Compute simple moving averages from recent DailyPrice docs
     */
    async computeIndicators(symbol, close) {
        const history = await DailyPrice.find({ symbol })
            .sort({ date: -1 })
            .limit(200)
            .select('close atr14')
            .lean();

        const closes = history.map((d) => d.close).filter(Boolean);
        closes.unshift(close); // Include today's close

        const sma = (n) =>
            closes.length >= n
                ? parseFloat((closes.slice(0, n).reduce((a, b) => a + b, 0) / n).toFixed(2))
                : null;

        // ATR14 — simplified using last 14 close differences
        let atr14 = null;
        if (closes.length >= 15) {
            const trValues = closes.slice(0, 14).map((c, i) => Math.abs(c - closes[i + 1]));
            atr14 = parseFloat((trValues.reduce((a, b) => a + b, 0) / 14).toFixed(2));
        }

        return { sma20: sma(20), sma50: sma(50), sma200: sma(200), atr14 };
    }

    /**
     * Main collect method — loops all active stocks
     */
    async collect({ symbols = null, date = null } = {}) {
        await this.initCookies();

        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);

        if (!symbols) {
            const stocks = await Stock.find({ isActive: true }).select('symbol');
            symbols = stocks.map((s) => s.symbol);
        }

        let saved = 0, skipped = 0, failed = 0;

        for (const symbol of symbols) {
            try {
                const quote = await this.fetchQuote(symbol);
                if (!quote || !quote.close) { skipped++; continue; }

                const indicators = await this.computeIndicators(symbol, quote.close);

                await DailyPrice.findOneAndUpdate(
                    { symbol, date: targetDate },
                    {
                        $set: {
                            ...quote,
                            ...indicators,
                            date: targetDate,
                            symbol,
                        },
                    },
                    { upsert: true, new: true }
                );

                saved++;
                console.log(`[BhavCopy] ${symbol}: ₹${quote.close} | Del%: ${quote.deliveryPct}`);
            } catch (err) {
                console.error(`[BhavCopy] Failed ${symbol}: ${err.message}`);
                failed++;
            }
        }

        return { saved, skipped, failed, total: symbols.length };
    }
}

module.exports = BhavCopyCollector;
