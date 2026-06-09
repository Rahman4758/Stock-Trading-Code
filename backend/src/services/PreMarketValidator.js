const aiAgentService = require('./AiAgentService');

class PreMarketValidator {
    constructor() {
        this.systemPrompt = `SYSTEM PROMPT — PRE-MARKET CONVICTION VALIDATOR

You are the Pre-Market Conviction Validator in the Antigravity trading system.
You run between 9:00 AM and 9:14 AM IST, before market open.

You receive the final signal list prepared overnight.
Your job: validate each signal against the LATEST pre-market data.

You are the LAST LINE OF DEFENSE before trades are queued for execution.

You can do THREE things to any signal:
  1. CONFIRM — Signal intact, proceed as planned
  2. MODIFY — Signal valid but entry/SL/targets need recalculation
  3. CANCEL — Pre-market data invalidates this setup entirely

CANCEL triggers:
  - Stock gapping up more than 1.8% at pre-open (late entry risk)
  - Stock gapping down more than 1.5% for a LONG signal (setup failed)
  - SGX Nifty indicating Nifty open down more than 0.8% (bearish open)
  - Any breaking news in last 60 minutes directly affecting this stock
  - Peer stock in same sector down more than 2% pre-market`;
    }

    async validate(queuedSignals, marketContext) {
        const userPrompt = `USER PROMPT — PRE-MARKET VALIDATOR QUERY

TIME: 9:00 AM IST. Market opens in 15 minutes. Validate all queued signals.

CURRENT PRE-MARKET ENVIRONMENT:
  SGX Nifty: ${marketContext.sgx_change}%
  India VIX: ${marketContext.vix}
  SAA risk score: ${marketContext.saa_risk}/10
  Breaking news: ${marketContext.breaking_news || 'NONE'}

QUEUED SIGNALS:
${queuedSignals.map((s, i) => `
Signal #${i+1}: ${s.symbol} ${s.direction}
Planned entry: ₹${s.entry} | SL: ₹${s.sl}
Pre-open price: ₹${s.preopen_price} (${s.gap_pct}% gap)`
).join('\n---\n')}

For EACH signal, decide: CONFIRM / MODIFY / CANCEL.
Respond ONLY in JSON format.`;

        try {
            return await aiAgentService.prompt(this.systemPrompt, userPrompt);
        } catch (error) {
            console.error('[PreMarketValidator] Error:', error.message);
            throw error;
        }
    }
}

module.exports = new PreMarketValidator();
