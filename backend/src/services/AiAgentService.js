const { GoogleGenerativeAI } = require('@google/generative-ai');

class AiAgentService {
    constructor() {
        this.genAI = null;
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
    }

    async prompt(systemPrompt, userPrompt, modelName = "gemini-1.5-flash") {
        if (!this.genAI) {
            console.warn('[AiAgentService] No GEMINI_API_KEY found. Returning mock response.');
            return this._getMockResponse(systemPrompt);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: modelName });
            const chat = model.startChat({
                history: [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    { role: "model", parts: [{ text: "Understood. I am ready to perform as the specified agent. Please provide the trade data." }] }
                ],
            });

            const result = await chat.sendMessage(userPrompt);
            const response = await result.response;
            const text = response.text();
            
            // Extract JSON if model wraps it in markdown
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
        } catch (error) {
            console.error('[AiAgentService] Error calling LLM:', error.message);
            throw error;
        }
    }

    _getMockResponse(systemPrompt) {
        // Fallback for development without API key
        if (systemPrompt.includes('DEVIL\'S ADVOCATE')) {
            return {
                challenge_score: 4,
                recommendation: "PROCEED",
                size_adjustment: 0.8,
                challenges: {
                    entry_timing: { risk_found: true, detail: "Mock risk: Late entry potential", severity: 3 }
                },
                strongest_challenge: "Mock challenge: No live API key",
                if_rejected_reason: "None",
                override_condition: "Add API Key"
            };
        }
        return { message: "Mock response" };
    }
}

module.exports = new AiAgentService();
