const aiAgentService = require('./AiAgentService');

class DevilsAdvocate {
    constructor() {
        this.systemPrompt = `SYSTEM PROMPT — DEVIL'S ADVOCATE AGENT

You are the Devil's Advocate Agent in the Antigravity institutional trading system.
Your ONLY job is to find reasons why a proposed trade should NOT be taken.

You are NOT a neutral analyst. You are a professional skeptic.
You do NOT care about the bull case. Other agents handle that.
You look ONLY for weaknesses, traps, and failure scenarios.

You will receive a trade signal from the Scanner Agent with full data.
You must challenge it across 6 dimensions and return a challenge score.

IMPORTANT RULES:
1. Never validate the trade — your job is to challenge it
2. Even strong setups must be challenged — look harder
3. If you cannot find a challenge, say so explicitly with reason
4. Be specific — 'high VIX' is not enough, say exactly what the risk is
5. Respond ONLY in the specified JSON format
6. Each challenge must cite the specific data point that concerns you`;
    }

    async challenge(tradeData) {
        const userPrompt = `USER PROMPT — DEVIL'S ADVOCATE QUERY

A trade signal has been generated. Challenge it aggressively.

PROPOSED TRADE:
  Stock: ${tradeData.symbol}
  Direction: ${tradeData.direction || 'LONG'}
  Entry: ₹${tradeData.entry_price}
  Stop Loss: ₹${tradeData.sl_price} (${tradeData.sl_pct}% risk)
  Targets: T1=₹${tradeData.t1}  T2=₹${tradeData.t2}  T3=₹${tradeData.t3}
  Scanner Confidence: ${tradeData.confidence} / 1.0
  Signal Reason: ${tradeData.scanner_reason}

MARKET DATA AT TIME OF SIGNAL:
  India VIX: ${tradeData.vix}
  Nifty 5-day change: ${tradeData.nifty_5d_change}%
  FII net today: ₹${tradeData.fii_net} Cr
  Market Regime: ${tradeData.regime}
  SAA Risk Score: ${tradeData.saa_risk}/10
  SAA Summary: ${tradeData.saa_one_line}

STOCK-SPECIFIC DATA:
  OI signal: ${tradeData.oi_signal}  |  OI change: ${tradeData.oi_change_pct}%
  Delivery % today: ${tradeData.delivery_pct}%  |  5-day avg delivery: ${tradeData.delivery_5d_avg}%
  Stock move today: ${tradeData.stock_move_pct}%
  Stock 5-day change: ${tradeData.stock_5d_change}%
  Volume Ratio: ${tradeData.volume_ratio}x
  Sector performance: ${tradeData.sector_change}%
  Last 5 similar setups: ${tradeData.last5_outcomes}

YOUR TASK — Challenge across all 6 dimensions.
Respond ONLY in JSON format.`;

        try {
            return await aiAgentService.prompt(this.systemPrompt, userPrompt);
        } catch (error) {
            console.error('[DevilsAdvocate] Error:', error.message);
            throw error;
        }
    }
}

module.exports = new DevilsAdvocate();
