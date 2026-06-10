const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMService {
    constructor() {
        this.genAI = null;
        this.model = null;
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash',
                tools: [{ googleSearch: {} }] // Enable Google Search Grounding for real-time macro/news
            });
        }
    }

    async analyzeStock(symbol, portfolioData, priceActionData, trendData, momentumData, volumeAnalysis, oiData, fiiDiiData, dailyChanges) {
        if (!this.model) {
            console.warn('[LLMService] GEMINI_API_KEY not found. Returning error state.');
            return { success: false, error: "API Key Not Configured" };
        }

        const prompt = `You are an expert institutional stock market analyst specializing in Indian equities.
Your task is to analyze a user's portfolio and provide actionable insights based on quantitative, technical, derivatives, volume, delivery, and sentiment data.

For the stock ${symbol}, here is the current data snapshot:

1. Portfolio Data:
${JSON.stringify(portfolioData, null, 2)}

2. Price Action Data:
${JSON.stringify(priceActionData, null, 2)}

3. Trend Data:
${JSON.stringify(trendData, null, 2)}

4. Momentum Data:
${JSON.stringify(momentumData, null, 2)}

5. Volume & Delivery Analysis:
${JSON.stringify(volumeAnalysis, null, 2)}

6. Options/Derivatives Data:
${JSON.stringify(oiData, null, 2)}

7. Daily Changes ("Kya Badha, Kya Ghata"):
${JSON.stringify(dailyChanges, null, 2)}

Generate a detailed, professional, structured report for this stock. Include:
1. A summary of the current setup.
2. Global Macro Impact: Use your Google Search tool to find the latest global market conditions (US/Europe/Asia), geopolitical news, and trade details. Explain how this global environment will impact the Indian Market and specifically this stock.
3. Changes observed today vs yesterday in the provided data.
4. Your conviction and predicted direction considering both the raw data and global macro factors.
5. Actionable advice based on whether they own the stock, their Entry Price, Target Price, and Stop Loss. If they provided a target or stop loss, explicitly analyze if those levels are realistic given the current setup and give specific advice on them.

Write the output in beautiful, formatted Markdown. Do NOT wrap it in a code block. Limit your response to 500 words.`;

        let retries = 3;
        let delay = 2000; // start with 2 seconds

        while (retries > 0) {
            try {
                const result = await this.model.generateContent(prompt);
                return { success: true, text: result.response.text() };
            } catch (error) {
                retries--;
                console.error(`[LLMService] LLM API Error (${error.status || error.message}). Retries left: ${retries}`);
                
                // If we're out of retries, or if it's a fatal error (like 400 Bad Request / Invalid Key), don't retry.
                // 503 is Service Unavailable (high demand), 429 is Too Many Requests. Both warrant a retry.
                if (retries === 0 || (error.status && error.status !== 503 && error.status !== 429 && error.status !== 500)) {
                    return { success: false, error: error.message };
                }

                console.log(`[LLMService] Waiting ${delay}ms before retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // exponential backoff
            }
        }
    }

    async chatWithStock(symbol, previousContext, userMessage) {
        if (!this.model) {
            return { success: false, error: "API Key Not Configured" };
        }

        const prompt = `You are an expert AI stock analyst. You previously analyzed ${symbol}.
Here is your previous detailed analysis and current context:
${previousContext}

The user has a follow-up question regarding ${symbol}:
"${userMessage}"

Provide a concise, highly professional, and direct answer based on your previous analysis, current price action, and any relevant global macro events. You may use your Google Search tool to find the absolute latest news or real-time context if necessary to answer the user's question accurately.
Write the output in beautiful Markdown without wrapping it in a code block. Limit your response to 200 words.`;

        let retries = 3;
        let delay = 2000;
        while (retries > 0) {
            try {
                const result = await this.model.generateContent(prompt);
                return { success: true, text: result.response.text() };
            } catch (error) {
                retries--;
                console.error(`[LLMService] Chat API Error. Retries left: ${retries}`);
                if (retries === 0 || (error.status && error.status !== 503 && error.status !== 429 && error.status !== 500)) {
                    return { success: false, error: error.message };
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            }
        }
    }
}

    /**
     * Federal Bank-style Swing Trade Analysis
     * Runs the full institutional swing scanner prompt on a pre-filtered stock.
     */
    async federalBankAnalyze(symbol, algoData) {
        if (!this.model) {
            return { success: false, error: 'API Key Not Configured' };
        }

        const prompt = `You are an institutional-grade Swing Trade Scanner for NSE markets.
Your only job is to find stocks BEFORE the breakout becomes obvious to retail traders.
You are hunting for the next "Federal Bank type move" — stocks in silent accumulation phase that are about to break out.

════ STOCK DATA FOR ANALYSIS ════

Symbol: ${symbol}
Current Price: ₹${algoData.currentPrice}
Sector: ${algoData.sector || 'N/A'}
Date: ${new Date().toDateString()}

PRICE STRUCTURE:
- Price vs 200 EMA: ${algoData.price200emaDiff > 0 ? '+' : ''}${algoData.price200emaDiff?.toFixed(2)}%
- Price vs 50 EMA:  ${algoData.price50emaDiff > 0 ? '+' : ''}${algoData.price50emaDiff?.toFixed(2)}%
- RSI (14):         ${algoData.rsi14}
- Higher lows:      ${algoData.higherLows ? 'YES' : 'NO'}
- Near 52W High:    ${algoData.near52wHigh ? 'YES (' + algoData.distTo52wHighPct?.toFixed(1) + '% away)' : 'NO'}
- Weeks in Base:    ${algoData.weeksInBase || 'N/A'}

DELIVERY DATA:
- Today's Delivery %: ${algoData.deliveryPct}%
- 5-Day Trend: ${algoData.deliveryTrend5d}
- 10-Day Trend: ${algoData.deliveryTrend10d}
- Delivery Rising on Flat/Down Days: ${algoData.deliveryRisingOnWeakDays ? 'YES' : 'NO'}

VOLUME DATA:
- Today vs 20D Avg: ${algoData.volumeVsAvg?.toFixed(2)}x
- Volume in Base (last 15D): ${algoData.baseVolumePattern}
- Distribution Days (High Vol Down): ${algoData.distributionDays}

OI / DERIVATIVES:
- PCR: ${algoData.pcr || 'N/A'}
- PCR Trend: ${algoData.pcrTrend || 'N/A'}
- OI Signal: ${algoData.oiSignal || 'N/A'}
- Put Writing Level: ${algoData.putWritingLevel || 'N/A'}
- Call Writing Level: ${algoData.callWritingLevel || 'N/A'}
- FutureOI Change (last 3d): ${algoData.futureOiChange3d > 0 ? '+' : ''}${algoData.futureOiChange3d?.toFixed(2)}%

RELATIVE STRENGTH:
- vs Nifty (10D): ${algoData.rsVsNifty10d > 0 ? '+' : ''}${algoData.rsVsNifty10d?.toFixed(2)}%
- vs Sector (5D): ${algoData.rsVsSector5d > 0 ? '+' : ''}${algoData.rsVsSector5d?.toFixed(2)}%

INSTITUTIONAL (CONVICTION SCORE): ${algoData.convictionScore}/100

SUPPORT LEVELS: ${JSON.stringify(algoData.support)}
RESISTANCE LEVELS: ${JSON.stringify(algoData.resistance)}
52-WEEK HIGH: ₹${algoData.high52w}

════ FEDERAL BANK SETUP DEFINITION ════

Stage 1 — BASE BUILDING: Sideways for 3-8 weeks after uptrend, volume contracting, delivery rising.
Stage 2 — BREAKOUT: Price breaks resistance on volume > 2.5x, delivery > 50%, OI confirms long buildup.
Stage 3 — TOPPING: Avoid.
Stage 4 — DOWNTREND: Avoid completely.

SWING SCORE (out of 100):
- Price Structure: 20 pts (200 EMA +5, 50 EMA +5, Higher lows +5, Near breakout +5)
- OI Structure: 25 pts (PCR > 1 +8, Put writing at support +9, Call OI weak +8)
- Delivery: 20 pts (Today > 45% +7, 5D rising +7, 10D rising +6)
- Volume: 15 pts (Contraction in base +8, No distribution +7)
- Relative Strength: 10 pts (vs Nifty +5, vs Sector +5)
- Risk Reward: 10 pts (RR > 1:3 = +6, RR > 1:4 = +4 bonus)

ALERT ONLY IF SCORE > 75.

════ OUTPUT FORMAT (follow EXACTLY) ════

Return ONLY a valid JSON object. No markdown, no explanation outside the JSON.

{
  "swingScore": <number 0-100>,
  "scoreBreakdown": {
    "priceStructure": <0-20>,
    "oiStructure": <0-25>,
    "delivery": <0-20>,
    "volume": <0-15>,
    "relativeStrength": <0-10>,
    "riskReward": <0-10>
  },
  "stage": "<1-Early|1-Mid|1-Late|2-Fresh|2-Ongoing|2-Extended|3-Topping|4-Downtrend>",
  "federalBankSimilarity": <0-10>,
  "keyMatchingFactors": ["<factor1>", "<factor2>"],
  "trend": "<BULLISH|NEUTRAL|BEARISH>",
  "deliveryVerdict": "<BULLISH|NEUTRAL|BEARISH>",
  "deliveryInterpretation": "<Accumulation|Distribution|Neutral>",
  "volumeVerdict": "<STRONG|AVERAGE|WEAK>",
  "baseVolumePattern": "<CONTRACTING|EXPANDING|MIXED>",
  "oiVerdict": "<BULLISH|NEUTRAL|BEARISH>",
  "oiSignalLabel": "<Long Buildup|Short Covering|Neutral|Warning>",
  "smartMoneySignal": "<ACCUMULATION|DISTRIBUTION|NEUTRAL>",
  "institutionalActivity": "<ACCUMULATION|DISTRIBUTION|NEUTRAL>",
  "optionTrapAlert": <true|false>,
  "rsVsNifty": "<OUTPERFORMING|UNDERPERFORMING>",
  "rsVsSector": "<OUTPERFORMING|UNDERPERFORMING>",
  "entryType": "<PRE-BREAKOUT|BREAKOUT|PULLBACK|NONE>",
  "entryZone": { "low": <price>, "high": <price> },
  "stopLoss": <price>,
  "target1": <price>,
  "target2": <price>,
  "target3": <price>,
  "rrRatio": <number>,
  "holdingPeriodDays": "<e.g. 10 to 20>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "action": "<BUY|WATCHLIST|AVOID>",
  "mostImportantReason": "<2 lines max>",
  "redFlags": "<comma separated or empty string>",
  "llmReport": "<Full formatted Markdown report as a single string. Use \\n for newlines. Include the complete SWING TRADE ALERT output format from the prompt.>"
}`;

        let retries = 3;
        let delay = 2000;
        while (retries > 0) {
            try {
                // Use a model without search grounding for structured JSON output
                const jsonModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const result = await jsonModel.generateContent(prompt);
                const raw = result.response.text().trim();
                // Strip markdown code fences if present
                const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                const parsed = JSON.parse(clean);
                return { success: true, data: parsed };
            } catch (error) {
                retries--;
                console.error(`[LLMService] federalBankAnalyze error for ${symbol}: ${error.message}. Retries left: ${retries}`);
                if (retries === 0 || (error.status && error.status !== 503 && error.status !== 429 && error.status !== 500)) {
                    return { success: false, error: error.message };
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            }
        }
        return { success: false, error: 'Max retries exceeded' };
    }
}

module.exports = new LLMService();

