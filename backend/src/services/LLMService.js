const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMService {
    constructor() {
        this.genAI = null;
        this.model = null;
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                tools: [{ googleSearch: {} }]
            });
        }
        
        this.genAIFlash = null;
        if (process.env.GEMINI_API_KEY_FLASH) {
            this.genAIFlash = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_FLASH);
        } else if (process.env.GEMINI_API_KEY) {
            this.genAIFlash = this.genAI; // Fallback to main key if flash key is missing
        }
    }

    async analyzeStock(symbol, portfolioData, priceActionData, trendData, momentumData, volumeAnalysis, oiData, fiiDiiData, dailyChanges) {
        if (!this.model) {
            console.warn('[LLMService] GEMINI_API_KEY not found. Returning error state.');
            return { success: false, error: 'API Key Not Configured' };
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
        let delay = 2000;

        while (retries > 0) {
            try {
                const result = await this.model.generateContent(prompt);
                return { success: true, text: result.response.text() };
            } catch (error) {
                retries--;
                console.error(`[LLMService] LLM API Error (${error.status || error.message}). Retries left: ${retries}`);
                if (retries === 0 || (error.status && error.status !== 503 && error.status !== 429 && error.status !== 500)) {
                    return { success: false, error: error.message };
                }
                console.log(`[LLMService] Waiting ${delay}ms before retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            }
        }
    }

    async chatWithStock(symbol, previousContext, userMessage) {
        if (!this.model) {
            return { success: false, error: 'API Key Not Configured' };
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

    async federalBankAnalyze(symbol, algoData) {
        if (!this.model) {
            return { success: false, error: 'API Key Not Configured' };
        }

        const prompt = `You are an institutional-grade Swing Trade Scanner for NSE markets.
Your only job is to find stocks BEFORE the breakout becomes obvious to retail traders.
You are hunting for the next "Federal Bank type move" — stocks in silent accumulation phase that are about to break out.

STOCK DATA FOR ANALYSIS:
Symbol: ${symbol}
Current Price: Rs.${algoData.currentPrice}
Sector: ${algoData.sector || 'N/A'}
Date: ${new Date().toDateString()}

PRICE STRUCTURE:
- Price vs 200 EMA: ${algoData.price200emaDiff > 0 ? '+' : ''}${algoData.price200emaDiff ? algoData.price200emaDiff.toFixed(2) : 0}%
- Price vs 50 EMA: ${algoData.price50emaDiff > 0 ? '+' : ''}${algoData.price50emaDiff ? algoData.price50emaDiff.toFixed(2) : 0}%
- RSI (14): ${algoData.rsi14}
- Higher lows forming: ${algoData.higherLows ? 'YES' : 'NO'}
- Near 52W High: ${algoData.near52wHigh ? 'YES (' + (algoData.distTo52wHighPct ? algoData.distTo52wHighPct.toFixed(1) : 0) + '% away)' : 'NO'}
- Weeks in Base: ${algoData.weeksInBase || 'N/A'}

DELIVERY DATA:
- Today Delivery %: ${algoData.deliveryPct}%
- 5-Day Trend: ${algoData.deliveryTrend5d}
- 10-Day Trend: ${algoData.deliveryTrend10d}
- Delivery Rising on Flat/Down Days: ${algoData.deliveryRisingOnWeakDays ? 'YES' : 'NO'}

VOLUME DATA:
- Today vs 20D Avg: ${algoData.volumeVsAvg ? algoData.volumeVsAvg.toFixed(2) : 0}x
- Volume in Base (last 15D): ${algoData.baseVolumePattern}
- Distribution Days: ${algoData.distributionDays}

OI / DERIVATIVES:
- PCR: ${algoData.pcr || 'N/A'}
- PCR Trend: ${algoData.pcrTrend || 'N/A'}
- OI Signal: ${algoData.oiSignal || 'N/A'}
- FutureOI Change (3d): ${algoData.futureOiChange3d > 0 ? '+' : ''}${algoData.futureOiChange3d ? algoData.futureOiChange3d.toFixed(2) : 0}%

RELATIVE STRENGTH:
- vs Nifty (10D): ${algoData.rsVsNifty10d > 0 ? '+' : ''}${algoData.rsVsNifty10d ? algoData.rsVsNifty10d.toFixed(2) : 0}%

INSTITUTIONAL SCORE: ${algoData.convictionScore}/100
SUPPORT: ${JSON.stringify(algoData.support)}
RESISTANCE: ${JSON.stringify(algoData.resistance)}
52W HIGH: Rs.${algoData.high52w}

SWING SCORE RUBRIC (out of 100):
- Price Structure: 20 pts (200 EMA +5, 50 EMA +5, Higher lows +5, Near breakout +5)
- OI Structure: 25 pts (PCR>1 +8, Put writing at support +9, Call OI weak +8)
- Delivery: 20 pts (Today>45% +7, 5D rising +7, 10D rising +6)
- Volume: 15 pts (Contraction in base +8, No distribution +7)
- Relative Strength: 10 pts (vs Nifty +5, vs Sector +5)
- Risk Reward: 10 pts (RR>1:3 +6, RR>1:4 +4 bonus)

Return ONLY a valid JSON object with NO markdown, NO explanation outside JSON:
{
  "swingScore": <0-100>,
  "scoreBreakdown": { "priceStructure": <0-20>, "oiStructure": <0-25>, "delivery": <0-20>, "volume": <0-15>, "relativeStrength": <0-10>, "riskReward": <0-10> },
  "stage": "<1-Early|1-Mid|1-Late|2-Fresh|2-Ongoing|2-Extended|3-Topping|4-Downtrend>",
  "federalBankSimilarity": <0-10>,
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
  "llmReport": "<Full formatted Markdown SWING TRADE ALERT report as a single string, use \\n for newlines>"
}`;

        let retries = 3;
        let delay = 2000;
        while (retries > 0) {
            try {
                if (!this.genAIFlash) throw new Error('API Key for Gemini not configured');
                const jsonModel = this.genAIFlash.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const result = await jsonModel.generateContent(prompt);
                const raw = result.response.text().trim();
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
