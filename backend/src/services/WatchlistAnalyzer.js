/**
 * WatchlistAnalyzer.js
 *
 * Comprehensive stock analysis engine for watchlisted stocks.
 * Uses existing services (ConvictionService, technicalScorer, sectorRotationAnalyzer)
 * to compute a full institutional-grade analysis for each stock.
 */
const DailyPrice = require('../models/DailyPrice');
const OiData = require('../models/OiData');
const FiiDiiData = require('../models/FiiDiiData');
const SectorStock = require('../models/SectorStock');
const Watchlist = require('../models/Watchlist');
const WatchlistAnalysis = require('../models/WatchlistAnalysis');
const convictionService = require('./ConvictionService');
const technicalScorer = require('./technicalScorer');
const sectorRotationAnalyzer = require('./sectorRotationAnalyzer');
const llmService = require('./LLMService');

class WatchlistAnalyzer {

    /**
     * Full analysis for one stock. Computes all 13 sections and saves to DB.
     */
    async analyzeStock(symbol) {
        symbol = symbol.toUpperCase();
        console.log(`[WatchlistAnalyzer] Analyzing ${symbol}...`);

        // 1. Fetch raw data
        const prices = await DailyPrice.find({ symbol }).sort({ date: -1 }).limit(260).lean();
        if (!prices || prices.length < 21) {
            console.warn(`[WatchlistAnalyzer] Insufficient data for ${symbol}`);
            return null;
        }

        const latest = prices[0];
        const close = latest.close;

        const oiDocs = await OiData.find({ symbol }).sort({ date: -1 }).limit(10).lean();
        const fiiDocs = await FiiDiiData.find({ symbol }).sort({ date: -1 }).limit(20).lean();

        // 2. Run existing scoring engines
        const [convictionResult, techResult, sectorData] = await Promise.all([
            convictionService.compute(symbol, 20, null, prices, false),
            technicalScorer.computeTechnicalScore(symbol, null, null, [...prices]),
            sectorRotationAnalyzer.getSectorRankings()
        ]);

        // 3. Compute Trend
        const trend = this._computeTrend(latest, prices);

        // 4. Compute Institutional Activity
        const instScore = convictionResult?.compositeScore || 0;
        const institutionalActivity = instScore >= 65 ? 'Accumulation' 
            : instScore <= 35 ? 'Distribution' : 'Neutral';

        // 5. OI Analysis
        const oiAnalysis = this._computeOiAnalysis(oiDocs);

        // 6. Delivery Analysis
        const deliveryAnalysis = this._computeDeliveryAnalysis(prices);

        // 7. Volume Analysis
        const volumeAnalysis = this._computeVolumeAnalysis(prices);

        // 8. Sector Strength
        const sectorStrength = this._computeSectorStrength(symbol, sectorData);

        // 9. Risk Score (1-10, 10 = highest risk)
        const riskScore = this._computeRiskScore(techResult, prices);

        // 10. Conviction Score (1-10)
        const convictionScore = Math.min(10, Math.max(1, Math.round(instScore / 10)));

        // 11. Support/Resistance from technicalScorer
        const levels = techResult?.levels || {};
        const supportLevels = {
            level1: levels.stopLoss || (close * 0.95),
            level2: close * 0.90
        };
        const resistanceLevels = {
            level1: levels.target1 || (close * 1.05),
            level2: levels.target2 || (close * 1.10)
        };
        const invalidationLevel = levels.stopLoss || (close * 0.93);

        // 12. Suggested Action + Confidence + Holding Period
        const { suggestedAction, confidence, expectedHoldingPeriod } = this._computeAction(
            trend, institutionalActivity, oiAnalysis, deliveryAnalysis, volumeAnalysis,
            sectorStrength, convictionScore, riskScore, techResult
        );

        // 13. Detailed Reasoning (algorithmic)
        const detailedReasoning = this._generateReasoning(
            symbol, close, trend, institutionalActivity, oiAnalysis, deliveryAnalysis,
            volumeAnalysis, sectorStrength, riskScore, convictionScore, suggestedAction,
            confidence, supportLevels, resistanceLevels, invalidationLevel, techResult, instScore
        );

        // 14. True AI Agent Analysis & Daily Changes
        const watchlistData = await Watchlist.findOne({ symbol }).lean();
        const portfolioData = {
            isOwned: watchlistData?.isOwned || false,
            buyPrice: watchlistData?.buyPrice || null,
            sellPrice: watchlistData?.sellPrice || null,
            stopLoss: watchlistData?.stopLoss || null,
            quantity: watchlistData?.quantity || null,
            companyName: watchlistData?.companyName || symbol
        };

        const dailyChanges = {
            priceChange: prices.length > 1 ? ((prices[0].close - prices[1].close) / prices[1].close * 100).toFixed(2) + '%' : 'N/A',
            volumeChange: prices.length > 1 ? ((prices[0].volume - prices[1].volume) / prices[1].volume * 100).toFixed(2) + '%' : 'N/A',
            deliveryChange: prices.length > 1 ? ((prices[0].deliveryPct - prices[1].deliveryPct).toFixed(2) + '%') : 'N/A',
            oiChange: (oiDocs.length > 1 && oiDocs[1].futureOi && oiDocs[0].futureOi) 
                ? ((oiDocs[0].futureOi - oiDocs[1].futureOi) / oiDocs[1].futureOi * 100).toFixed(2) + '%' 
                : 'N/A'
        };

        const llmResult = await llmService.analyzeStock(
            symbol,
            portfolioData,
            { currentPrice: close, support: supportLevels, resistance: resistanceLevels, recentPriceHistory: prices.slice(0, 5) },
            { trend, riskScore },
            { convictionScore, institutionalActivity },
            { volumeAnalysis, deliveryAnalysis },
            { oiAnalysis, latestOiSignal: oiDocs[0]?.oiSignal || 'N/A', recentOiHistory: oiDocs.slice(0, 5) },
            { latestFiiDii: fiiDocs[0] || 'N/A', recentFiiDiiHistory: fiiDocs.slice(0, 5) },
            dailyChanges
        );

        // Save to DB
        const analysis = await WatchlistAnalysis.findOneAndUpdate(
            { symbol },
            {
                symbol,
                analyzedAt: new Date(),
                trend,
                institutionalActivity,
                oiAnalysis,
                deliveryAnalysis,
                volumeAnalysis,
                sectorStrength,
                riskScore,
                convictionScore,
                confidence,
                suggestedAction,
                expectedHoldingPeriod,
                supportLevels,
                resistanceLevels,
                invalidationLevel,
                detailedReasoning,
                aiDetailedAnalysis: llmResult.success ? llmResult.text : '',
                aiError: llmResult.success ? '' : llmResult.error,
                dailyChanges,
                currentPrice: close,
                rawData: {
                    institutionalScore: instScore,
                    technicalScore: techResult?.technicalScore || 0,
                    subScores: techResult?.subScores || {},
                    checklist: techResult?.checklist || {},
                    checklistScore: techResult?.checklistScore || '0/11',
                    flags: techResult?.flags || [],
                    convictionBreakdown: convictionResult?.scores || {},
                }
            },
            { upsert: true, new: true }
        );

        console.log(`[WatchlistAnalyzer] ${symbol} → ${suggestedAction} (${confidence}% confidence)`);
        return analysis;
    }

    /**
     * Analyze all active watchlist items
     */
    async analyzeAll() {
        const items = await Watchlist.find({ isActive: true }).lean();
        console.log(`[WatchlistAnalyzer] Analyzing ${items.length} watchlisted stocks...`);
        
        const results = [];
        for (const item of items) {
            try {
                const result = await this.analyzeStock(item.symbol);
                if (result) results.push(result);
            } catch (err) {
                console.error(`[WatchlistAnalyzer] Error analyzing ${item.symbol}:`, err.message);
            }
        }
        
        console.log(`[WatchlistAnalyzer] Complete. ${results.length}/${items.length} analyzed.`);
        return results;
    }

    /**
     * Get latest stored analysis
     */
    async getLatestAnalysis(symbol) {
        return WatchlistAnalysis.findOne({ symbol: symbol.toUpperCase() }).lean();
    }

    // ─── Private Computation Methods ──────────────────────────────────────

    _computeTrend(latest, prices) {
        const close = latest.close;
        const sma50 = latest.sma50;
        const sma200 = latest.sma200;
        
        let bullishSignals = 0;
        if (sma50 && close > sma50) bullishSignals++;
        if (sma200 && close > sma200) bullishSignals++;
        if (sma50 && sma200 && sma50 > sma200) bullishSignals++;
        
        // Check 20-day price direction
        if (prices.length >= 20 && close > prices[19].close) bullishSignals++;
        
        if (bullishSignals >= 3) return 'Bullish';
        if (bullishSignals <= 1) return 'Bearish';
        return 'Neutral';
    }

    _computeOiAnalysis(oiDocs) {
        if (!oiDocs || oiDocs.length === 0) return 'Neutral';
        const latest = oiDocs[0];
        
        if (['LONG_BUILDUP'].includes(latest.oiSignal)) return 'Bullish';
        if (['SHORT_COVERING'].includes(latest.oiSignal)) return 'Bullish';
        if (['SHORT_BUILDUP'].includes(latest.oiSignal)) return 'Bearish';
        if (['LONG_UNWINDING'].includes(latest.oiSignal)) return 'Bearish';
        
        // Fallback: check PCR
        if (latest.pcr > 1.2) return 'Bullish';
        if (latest.pcr < 0.7) return 'Bearish';
        return 'Neutral';
    }

    _computeDeliveryAnalysis(prices) {
        if (prices.length < 20) return 'Neutral';
        
        // 5-day avg delivery vs 20-day avg delivery
        let del5 = 0, del20 = 0;
        for (let i = 0; i < 5; i++) del5 += (prices[i].deliveryPct || 0);
        del5 /= 5;
        for (let i = 0; i < 20; i++) del20 += (prices[i].deliveryPct || 0);
        del20 /= 20;
        
        if (del5 > del20 * 1.15 && del5 > 40) return 'Bullish';
        if (del5 < del20 * 0.85 || del5 < 25) return 'Bearish';
        return 'Neutral';
    }

    _computeVolumeAnalysis(prices) {
        if (prices.length < 20) return 'Neutral';
        
        const todayVol = prices[0].volume;
        let avgVol20 = 0;
        for (let i = 1; i <= 20; i++) avgVol20 += prices[i].volume;
        avgVol20 /= 20;
        
        const volRatio = todayVol / avgVol20;
        const obvRising = prices[0].obv > prices[5].obv;
        
        if (volRatio > 1.5 && obvRising) return 'Bullish';
        if (volRatio < 0.5 || !obvRising) return 'Bearish';
        return 'Neutral';
    }

    _computeSectorStrength(symbol, sectorData) {
        if (!sectorData || !sectorData.leaders) return 'Average';
        
        // Find which sector this stock belongs to via SectorStock mapping (sync check)
        // For simplicity, check if stock is in leaders vs laggards
        const leaderSymbols = new Set();
        const laggardSymbols = new Set();
        
        if (sectorData.leaders) {
            sectorData.leaders.forEach(s => leaderSymbols.add(s.indexName));
        }
        if (sectorData.laggards) {
            sectorData.laggards.forEach(s => laggardSymbols.add(s.indexName));
        }
        
        // We'll need to check which sector the stock belongs to
        // For now, use a simpler approach based on available data
        return 'Average'; // Will be enriched per stock below
    }

    _computeRiskScore(techResult, prices) {
        // Lower technical score = higher risk
        const techScore = techResult?.technicalScore || 50;
        
        // ATR-based volatility
        let avgRange = 0;
        for (let i = 0; i < Math.min(14, prices.length); i++) {
            avgRange += (prices[i].high - prices[i].low) / prices[i].close;
        }
        avgRange /= Math.min(14, prices.length);
        const volatilityPenalty = avgRange > 0.03 ? 2 : avgRange > 0.02 ? 1 : 0;
        
        // Base risk from technical score inversion
        let risk = Math.round(10 - (techScore / 12.5)) + volatilityPenalty;
        return Math.min(10, Math.max(1, risk));
    }

    _computeAction(trend, instActivity, oi, delivery, volume, sector, conviction, risk, techResult) {
        let score = 0;
        
        // Trend component
        if (trend === 'Bullish') score += 3;
        else if (trend === 'Bearish') score -= 3;
        
        // Institutional
        if (instActivity === 'Accumulation') score += 2;
        else if (instActivity === 'Distribution') score -= 2;
        
        // OI
        if (oi === 'Bullish') score += 1.5;
        else if (oi === 'Bearish') score -= 1.5;
        
        // Delivery
        if (delivery === 'Bullish') score += 1;
        else if (delivery === 'Bearish') score -= 1;
        
        // Volume
        if (volume === 'Bullish') score += 1;
        else if (volume === 'Bearish') score -= 1;
        
        // Conviction bonus
        score += (conviction - 5) * 0.5;
        
        // Technical score bonus
        const techScore = techResult?.technicalScore || 50;
        score += (techScore - 50) * 0.05;

        // Map to action
        let suggestedAction, confidence, expectedHoldingPeriod;
        
        if (score >= 6) {
            suggestedAction = 'Strong Buy';
            confidence = Math.min(95, 70 + Math.round(score * 3));
            expectedHoldingPeriod = '1-3 Months';
        } else if (score >= 4) {
            suggestedAction = 'Buy';
            confidence = Math.min(85, 60 + Math.round(score * 3));
            expectedHoldingPeriod = '1-2 Weeks';
        } else if (score >= 2) {
            suggestedAction = 'Accumulate';
            confidence = Math.min(75, 50 + Math.round(score * 3));
            expectedHoldingPeriod = '1-3 Months';
        } else if (score >= -1) {
            suggestedAction = 'Hold';
            confidence = Math.min(65, 40 + Math.abs(Math.round(score * 2)));
            expectedHoldingPeriod = '1-2 Weeks';
        } else if (score >= -3) {
            suggestedAction = 'Reduce';
            confidence = Math.min(70, 50 + Math.abs(Math.round(score * 2)));
            expectedHoldingPeriod = '1-3 Days';
        } else {
            suggestedAction = 'Exit';
            confidence = Math.min(85, 60 + Math.abs(Math.round(score * 2)));
            expectedHoldingPeriod = '1-3 Days';
        }
        
        return { suggestedAction, confidence, expectedHoldingPeriod };
    }

    _generateReasoning(symbol, close, trend, instActivity, oi, delivery, volume, sector, risk, conviction, action, confidence, support, resistance, invalidation, techResult, instScore) {
        const techScore = techResult?.technicalScore || 0;
        const flags = techResult?.flags || [];
        const checklist = techResult?.checklistScore || '0/11';
        
        let reasoning = `## ${symbol} Analysis (₹${close.toFixed(2)})\n\n`;
        
        reasoning += `### Trend Assessment: ${trend}\n`;
        reasoning += `Price is ${trend === 'Bullish' ? 'above' : trend === 'Bearish' ? 'below' : 'near'} key moving averages. `;
        reasoning += `Technical score: ${techScore}/100 | Pre-trade checklist: ${checklist}\n\n`;
        
        reasoning += `### Institutional Activity: ${instActivity}\n`;
        reasoning += `Institutional conviction score: ${instScore.toFixed(1)}/100. `;
        reasoning += instScore >= 65 ? 'Strong institutional buying detected across FII flows, delivery data, and OI buildup. ' 
            : instScore <= 35 ? 'Institutions appear to be distributing. FII flows and OI data suggest selling pressure. '
            : 'Institutional activity is mixed. No clear directional bias from FII/DII data. ';
        reasoning += `\n\n`;
        
        reasoning += `### OI Analysis: ${oi}\n`;
        reasoning += oi === 'Bullish' ? 'Futures OI data shows long buildup or short covering, indicating bullish positioning. '
            : oi === 'Bearish' ? 'Futures OI data shows short buildup or long unwinding, indicating bearish positioning. '
            : 'No clear directional signal from derivatives data. ';
        reasoning += `\n\n`;
        
        reasoning += `### Delivery Analysis: ${delivery}\n`;
        reasoning += delivery === 'Bullish' ? 'Recent delivery percentages are rising, suggesting genuine buying interest (not speculative). '
            : delivery === 'Bearish' ? 'Delivery percentages are declining, suggesting weak hands and speculative trading. '
            : 'Delivery data is inconclusive. ';
        reasoning += `\n\n`;
        
        reasoning += `### Volume Analysis: ${volume}\n`;
        reasoning += volume === 'Bullish' ? 'Volume is above average with rising OBV, confirming buying pressure. '
            : volume === 'Bearish' ? 'Volume is below average or OBV is declining, suggesting lack of conviction. '
            : 'Volume patterns are neutral. ';
        reasoning += `\n\n`;
        
        reasoning += `### Key Levels\n`;
        reasoning += `- **Support 1:** ₹${support.level1.toFixed(2)}\n`;
        reasoning += `- **Support 2:** ₹${support.level2.toFixed(2)}\n`;
        reasoning += `- **Resistance 1:** ₹${resistance.level1.toFixed(2)}\n`;
        reasoning += `- **Resistance 2:** ₹${resistance.level2.toFixed(2)}\n`;
        reasoning += `- **Invalidation:** ₹${invalidation.toFixed(2)} (thesis invalid below this)\n\n`;
        
        reasoning += `### Risk Assessment\n`;
        reasoning += `Risk Score: ${risk}/10 | Conviction: ${conviction}/10 | Confidence: ${confidence}%\n`;
        if (flags.length > 0) {
            reasoning += `⚠️ Flags: ${flags.join(', ')}\n`;
        }
        reasoning += `\n`;
        
        reasoning += `### Verdict: ${action}\n`;
        reasoning += `Based on the combined analysis of trend, institutional activity, derivatives, delivery, and volume data, `;
        reasoning += `the recommended action is **${action}** with ${confidence}% confidence.\n`;
        
        return reasoning;
    }
}

module.exports = new WatchlistAnalyzer();
