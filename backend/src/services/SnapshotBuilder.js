const DailySnapshot = require('../models/DailySnapshot');
const DailyPrice = require('../models/DailyPrice');
const FiiDiiData = require('../models/FiiDiiData');
const ConvictionEngine = require('./ConvictionEngine');

/**
 * Service to aggregate data from various collectors and build the DailySnapshot 
 * using the ConvictionEngine.
 */
class SnapshotBuilder {
    
    /**
     * Build and store the daily snapshot for a specific symbol.
     * @param {string} symbol 
     * @param {Date} date - the date for the snapshot 
     */
    static async buildSnapshotForSymbol(symbol, targetDate) {
        try {
            // Target date normalized to Midday UTC
            const startOfDay = new Date(targetDate);
            startOfDay.setUTCHours(12, 0, 0, 0);

            // Fetch the last 15 days of data foraverages
            const fifteenDaysAgo = new Date(startOfDay.getTime() - (15 * 24 * 60 * 60 * 1000));

            const [latestPrice, priceHistory, marketFiiData] = await Promise.all([
                DailyPrice.findOne({ symbol, date: startOfDay }),
                DailyPrice.find({ symbol, date: { $lt: startOfDay } }).sort({ date: -1 }).limit(15),
                FiiDiiData.findOne({ symbol: 'TOTAL_MARKET', date: startOfDay })
            ]);

            if (!latestPrice) {
                console.log(`[SnapshotBuilder] No DailyPrice found for ${symbol} on ${targetDate.toISOString().split('T')[0]}. Skipping.`);
                return null;
            }

            // --- SAA INSTITUTIONAL ATTRIBUTION (DIRECTIONAL FLOW) ---
            const marketFiiNet = marketFiiData ? marketFiiData.fiiNet : 0;
            const marketDiiNet = marketFiiData ? marketFiiData.diiNet : 0;
            
            const deliveryFactor = (latestPrice.deliveryPct || 0) / 100;
            const dailyVolume = latestPrice.volume || 0;
            const avgVolume = priceHistory.length > 0 
                ? priceHistory.reduce((acc, curr) => acc + (curr.volume || 0), 0) / priceHistory.length
                : dailyVolume || 1;
            const volumeRatio = dailyVolume / (avgVolume || 1);
            
            // Scaled Attribution: Market Total * Stock Relative Strength
            // We use a smaller divisor (15) to ensure numbers are visible as 'Cr'
            const attributedFii = (marketFiiNet * deliveryFactor * Math.min(volumeRatio, 2)) / 15;
            const attributedDii = (marketDiiNet * deliveryFactor * Math.min(volumeRatio, 2)) / 15;
            // ---------------------------------------------------


            // Fetch dynamic weights from system config
            const SystemConfigService = require('./SystemConfigService');
            const config = await SystemConfigService.getConfig();
            const weights = config ? config.weights : null;

            const vwapProxy = latestPrice.avgPrice || (latestPrice.high + latestPrice.low + latestPrice.close) / 3;
            const vwapPosition = latestPrice.close >= vwapProxy ? 'Above' : 'Below';

            let rsi = 50; 
            if (priceHistory.length >= 14) {
                const changes = [];
                for (let i = 0; i < priceHistory.length - 1; i++) {
                    changes.push(priceHistory[i].close - priceHistory[i+1].close);
                }
                const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14;
                const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / 14;
                rsi = losses === 0 ? 100 : 100 - (100 / (1 + (gains / (losses || 1))));
            }

            // Compute conviction scores
            const convictionData = ConvictionEngine.calculateConviction({
                avg_fii_net: attributedFii,
                avg_dii_net: attributedDii,
                pcr: latestPrice.pcr || 1.0, // Default to neutral PCR if missing
                del_pct: latestPrice.deliveryPct || 0,
                rev_growth: 0,
                volume_ratio: volumeRatio,
                rsi: rsi
            }, weights);

            // Prepare snapshot object mapping
            const snapshotDoc = {
                symbol,
                date: startOfDay,
                fii_net_cr: Math.round(attributedFii), // Round to nearest Cr for UI clarity
                dii_net_cr: Math.round(attributedDii),
                fii_fno_net: 0, 
                delivery_pct: parseFloat(latestPrice.deliveryPct?.toFixed(2) || "0"),
                pcr: latestPrice.pcr || 1.0,
                oi_change_pct: parseFloat(latestPrice.oiChangePct?.toFixed(2) || "0"), 
                iv_atm: 0, 
                close_price: latestPrice.close,
                
                volume_ratio: parseFloat(volumeRatio.toFixed(2)),
                rsi: parseFloat(rsi.toFixed(2)),
                vwap_position: vwapPosition,
                
                institutional_bias: convictionData.institutional_bias,
                conviction_score: convictionData.total_score,
                
                fii_trend_score: convictionData.fii_score,
                dii_trend_score: convictionData.dii_score,
                oi_pcr_score: convictionData.pcr_score,
                deliv_score: convictionData.deliv_score,
                fundamental_score: convictionData.fundamental_score
            };

            // Save to DB
            const savedSnapshot = await DailySnapshot.findOneAndUpdate(
                { symbol, date: startOfDay },
                { $set: snapshotDoc },
                { upsert: true, new: true }
            );

            console.log(`[SnapshotBuilder] Built snapshot for ${symbol} | FII: ${snapshotDoc.fii_net_cr}Cr | Score: ${savedSnapshot.conviction_score}`);
            return savedSnapshot;

        } catch (error) {
            console.error(`[SnapshotBuilder] Failed to build context for ${symbol}: ${error.message}`);
            return null;
        }
    }
}

module.exports = SnapshotBuilder;
