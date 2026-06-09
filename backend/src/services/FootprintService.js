/**
 * FootprintService.js
 *
 * All business logic for building the stock footprint chart.
 * The footprint.js ROUTE only calls this — no business logic in the route.
 *
 * Merges: DailyPrice + MarketFiiDiiData + OiData + BulkDeal into one time-series
 * array ready for Recharts on the frontend.
 *
 * Stock-level accumulation is calculated via:
 *   - Chaikin Money Flow (CMF-20): real price + volume indicator
 *   - Delivery Absorption Flow: volume × delivery%
 */
const priceRepo    = require('../repositories/PriceRepository');
const fiiRepo      = require('../repositories/FiiRepository');
const snapshotRepo = require('../repositories/SnapshotRepository');

class FootprintService {
    /**
     * Build the complete footprint dataset for a symbol.
     * @param {string}  symbol
     * @param {number}  [days=90]
     * @returns {Promise<{ symbol, dataPoints, chartData, latestScore }>}
     */
    async buildFootprint(symbol, days = 90) {
        symbol = symbol.toUpperCase();

        // Anchor to latest available price date for this symbol
        const latestPriceDoc = await priceRepo.getLatest(symbol);
        const endDate   = latestPriceDoc ? new Date(latestPriceDoc.date) : new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        // Fetch all data streams in parallel using Repositories
        const [prices, marketFiiFlow, oiDocs, bulkDeals, latestScore] = await Promise.all([
            priceRepo.getRange(symbol, startDate, endDate),
            fiiRepo.getDailyFlow('TOTAL_MARKET', startDate, endDate), // real NSE market-wide gross buy/sell
            snapshotRepo.getOiRange(symbol, startDate, endDate),
            snapshotRepo.getBulkDeals(symbol, startDate, endDate),
            snapshotRepo.getLatestScore(symbol),
        ]);

        // ── Build base chart from prices ──────────────────────────────────────
        const chartMap = new Map();
        prices.forEach(p => {
            const dateStr = p.date.toISOString().split('T')[0];
            chartMap.set(dateStr, {
                date:        dateStr,
                open:        p.open,
                high:        p.high,
                low:         p.low,
                close:       p.close,
                volume:      p.volume,
                deliveryPct: p.deliveryPct || 0,
                sma20:       p.sma20,
                sma50:       p.sma50,
            });
        });

        // Build a fast date→market-flow lookup (O(1))
        const marketFiiMap = new Map();
        marketFiiFlow.forEach(f => marketFiiMap.set(f.date, f));

        // ── Overlay Market-Wide FII/DII (gross buy/sell only — NSE authentic) ─
        marketFiiFlow.forEach(f => {
            if (chartMap.has(f.date)) {
                const entry = chartMap.get(f.date);
                entry.fiiBuy  = f.fiiGrossBuy  || 0;
                entry.fiiSell = f.fiiGrossSell || 0;
                entry.fiiNet  = f.fiiNet       || 0;
                entry.diiBuy  = f.diiGrossBuy  || 0;
                entry.diiSell = f.diiGrossSell || 0;
                entry.diiNet  = f.diiNet       || 0;
            }
        });

        // ── Overlay OI ────────────────────────────────────────────────────────
        oiDocs.forEach(o => {
            const dateStr = o.date.toISOString().split('T')[0];
            if (chartMap.has(dateStr)) {
                const entry = chartMap.get(dateStr);
                entry.oiChangePct = Number(o.futureOiChangePct);
                entry.oiSignal    = o.oiSignal || null;
                entry.oiDate      = dateStr;
            }
        });

        // ── Overlay Bulk Deals (aggregate buys/sells per day) ─────────────────
        bulkDeals.forEach(b => {
            const dateStr = b.date.toISOString().split('T')[0];
            if (chartMap.has(dateStr)) {
                const entry = chartMap.get(dateStr);
                entry.bulkBuys  = (entry.bulkBuys  || 0) + (b.dealType === 'BUY'  ? (b.dealValue || 0) : 0);
                entry.bulkSells = (entry.bulkSells || 0) + (b.dealType === 'SELL' ? (b.dealValue || 0) : 0);
            }
        });

        // Sort ascending
        const chartData = Array.from(chartMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // ── Chaikin Money Flow (CMF-20) ───────────────────────────────────────
        // Formula: CMF = Sum(MFV, 20) / Sum(Volume, 20)
        // Money Flow Volume (MFV) = ((Close-Low)-(High-Close))/(High-Low) * Volume
        // This is a TRUE stock-specific accumulation/distribution indicator
        // using only real price + volume data. No external API required.
        this._calcCmf(chartData, 20);

        // ── OI forward-fill ───────────────────────────────────────────────────
        // Fill gaps in OI data with the last known value so the chart always
        // shows a signal instead of a blank. This is business logic — lives here,
        // NOT in the route.
        this._forwardFillOi(chartData);

        // Ensure the last candle always shows the absolute latest OI, even if the price is 1 day lagging
        if (chartData.length > 0) {
            const last = chartData[chartData.length - 1];
            const latestOi = await snapshotRepo.getLatestOi(symbol);
            
            // If we have latest OI and (no OI in chart OR latest OI is newer than chart OI)
            if (latestOi && (!last.oiDate || new Date(latestOi.date) > new Date(last.oiDate))) {
                last.oiChangePct = Number(latestOi.futureOiChangePct || 0);
                last.oiSignal    = latestOi.oiSignal || null;
                last.oiDate      = latestOi.date?.toISOString().split('T')[0] || null;
            }
        }

        return {
            symbol,
            dataPoints:  chartData.length,
            chartData,
            latestScore: latestScore ? {
                compositeScore:   latestScore.compositeScore || latestScore.finalScore,
                interpretation:   latestScore.interpretation,
                scores:           latestScore.scores,
                anchorDate:       latestScore.date?.toISOString().split('T')[0],
            } : null,
        };
    }

    /**
     * Forward-fill OI values across the time series.
     * Mutates chartData in place.
     * @private
     */
    _forwardFillOi(chartData) {
        let lastOiPct    = null;
        let lastOiSignal = null;
        let lastOiDate   = null;

        for (const entry of chartData) {
            if (typeof entry.oiChangePct === 'number' && Number.isFinite(entry.oiChangePct)) {
                lastOiPct    = entry.oiChangePct;
                lastOiSignal = entry.oiSignal || lastOiSignal;
                lastOiDate   = entry.oiDate   || entry.date;
            } else if (lastOiPct !== null) {
                entry.oiChangePct = lastOiPct;
                entry.oiSignal    = lastOiSignal;
                entry.oiDate      = lastOiDate;
            }
        }
    }
    /**
     * Chaikin Money Flow (CMF) — 100% stock-specific, zero external API.
     *
     * For each candle:
     *   MFM (Money Flow Multiplier) = ((close - low) - (high - close)) / (high - low)
     *   MFV (Money Flow Volume)     = MFM × volume
     *   DeliveryFlow                = volume × (deliveryPct / 100)  ← strong-hands absorbed qty
     *
     * Rolling window:
     *   CMF(period) = Σ(MFV, period) / Σ(volume, period)
     *   Result is between -1 and +1. > 0 = accumulation, < 0 = distribution.
     *
     * Mutates each entry in chartData in place.
     * @param {Array}  chartData  - sorted ascending time series
     * @param {number} period     - rolling window size (default 20)
     * @private
     */
    _calcCmf(chartData, period = 20) {
        for (let i = 0; i < chartData.length; i++) {
            const entry = chartData[i];
            const { high, low, close, volume, deliveryPct } = entry;

            // Delivery Absorption Flow: shares that were ACTUALLY delivered (not squared off)
            // This is the best proxy for institutional accumulation in Indian markets
            entry.deliveryFlow = (volume || 0) * ((deliveryPct || 0) / 100);

            // Money Flow Multiplier — ranges from -1 to +1
            const range = (high || 0) - (low || 0);
            if (range <= 0) {
                entry.mfv = 0;
            } else {
                const mfm = ((close - low) - (high - close)) / range;
                entry.mfv = mfm * (volume || 0);
            }

            // CMF(20): rolling sum of MFV / rolling sum of Volume
            if (i >= period - 1) {
                const window = chartData.slice(i - period + 1, i + 1);
                const sumMfv    = window.reduce((s, c) => s + (c.mfv    || 0), 0);
                const sumVolume = window.reduce((s, c) => s + (c.volume || 0), 0);
                entry.cmf = sumVolume > 0 ? parseFloat((sumMfv / sumVolume).toFixed(4)) : 0;
            } else {
                entry.cmf = null; // not enough data yet for the rolling window
            }
        }
    }
}

module.exports = new FootprintService();
