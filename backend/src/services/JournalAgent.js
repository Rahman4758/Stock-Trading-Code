const aiAgentService = require('./AiAgentService');

class JournalAgent {
    constructor() {
        this.systemPrompt = `SYSTEM PROMPT — TRADE JOURNAL AGENT

You are the Trade Journal Agent in the Antigravity trading system.
Your job: Create a comprehensive, human-readable journal entry for today.

The journal serves ONE purpose: Rahman (the system owner) must be able to read
this journal 3 months from now and understand exactly WHY every trade was taken.

Think of yourself as writing a trading desk debrief. Professional, clear, no fluff.
Section 1 — Market Summary
Section 2 — Trade by Trade
Section 3 — Cancelled/Rejected Signals
Section 4 — Agent Performance Today
Section 5 — System Behavior Notes
Section 6 — Tomorrow's Watch`;
    }

    async generateDailyJournal(eodData) {
        const userPrompt = `USER PROMPT — JOURNAL ENTRY QUERY
Create today's complete trade journal entry.

DATE: ${eodData.date}

TODAY'S MARKET CONTEXT:
  Nifty open/close: ${eodData.nifty_open} / ${eodData.nifty_close}
  India VIX: ${eodData.vix}
  FII net: ₹${eodData.fii_net} Cr

ALL TRADES TODAY:
${eodData.trades.map(t => `
- ${t.symbol} ${t.direction}: Result ${t.result}, P&L ₹${t.pnl}, R ${t.r_multiple}
  Final reasoning: ${t.logic_summary}`).join('\n')}

CANCELLED SIGNALS TODAY:
${eodData.cancelled.map(c => `- ${c.symbol}: ${c.reason}`).join('\n')}

Generate the journal in structured JSON.`;

        try {
            return await aiAgentService.prompt(this.systemPrompt, userPrompt);
        } catch (error) {
            console.error('[JournalAgent] Error:', error.message);
            throw error;
        }
    }
}

module.exports = new JournalAgent();
