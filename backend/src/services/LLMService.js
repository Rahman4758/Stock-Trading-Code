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

module.exports = new LLMService();
