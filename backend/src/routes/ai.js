const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

router.post('/chat', async (req, res) => {
    try {
        if (!genAI) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        }

        const { symbol, contextData, message, history } = req.body;

        if (!symbol || !contextData) {
            return res.status(400).json({ error: 'Symbol and contextData are required.' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Build the system persona and context prompt
        const systemPrompt = `You are an Institutional Trader and Financial Market Expert. 
Your role is to analyze the provided institutional footprint data for the stock: ${symbol}. 
Use the data (Options OI, Price Action, Delivery Percentage, Technicals, etc.) to provide:
1. Conviction (High, Medium, Low)
2. Future projections & expected move directions.
3. Key levels to watch.
Always base your analysis on the provided data context. Be concise, professional, and use a sharp institutional tone.

--- DATA CONTEXT ---
${JSON.stringify(contextData, null, 2)}
--------------------`;

        // If no message is provided, the user wants the initial analysis report.
        let promptText = "";
        if (!message) {
            promptText = `${systemPrompt}\n\nPlease provide your initial expert analysis, conviction, and projection based purely on the data above.`;
        } else {
            // Build conversation history string
            let historyText = "";
            if (history && Array.isArray(history)) {
                history.forEach(h => {
                    historyText += `\n${h.role === 'user' ? 'User' : 'Expert'}: ${h.content}`;
                });
            }
            promptText = `${systemPrompt}\n\nChat History:${historyText}\n\nUser: ${message}\nExpert:`;
        }

        const result = await model.generateContent(promptText);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });

    } catch (err) {
        console.error('[AI Agent Error]', err);
        res.status(500).json({ error: 'Failed to generate AI response. ' + err.message });
    }
});

module.exports = router;
