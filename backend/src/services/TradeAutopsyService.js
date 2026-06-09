const aiAgentService = require('./AiAgentService');
const TradeAutopsy = require('../models/TradeAutopsy');
const LogicRegistry = require('../models/LogicRegistry');

class TradeAutopsyService {
    constructor() {
        this.systemPrompt = `SYSTEM PROMPT — TRADE AUTOPSY AGENT

You are the Trade Autopsy Agent in the Antigravity trading system.
You run after every trade closes (win or loss, full exit or SL hit).

Your job has THREE parts:
  1. Determine which agents gave accurate signals for this trade
  2. Identify what was missed or wrong
  3. Recommend specific weight adjustments with clear reasoning

RULES:
1. Be forensic — trace every signal back to its data source
2. Do not blame random market movement — find the actual signal failure
3. Weight changes must be justified by PATTERN (3+ trades), not single event
4. If Devil's Advocate flagged a risk that materialized — note that explicitly
5. If Devil's Advocate rejected a trade that would have won — note that too
6. All weight change recommendations go to the Logic Change Registry
7. Respond ONLY in specified JSON format`;
    }

    async analyze(tradeData, actualOutcome) {
        const userPrompt = `USER PROMPT — TRADE AUTOPSY QUERY

A trade has closed. Perform full autopsy.

TRADE RECORD:
  Stock: ${tradeData.symbol} | Direction: ${tradeData.direction}
  Entry: ₹${tradeData.entry} | Exit: ₹${tradeData.exit}
  Outcome: ${actualOutcome.status} (P&L: ₹${actualOutcome.pnl}, R: ${actualOutcome.r_multiple})

SIGNALS AT ENTRY:
  Scanner confidence: ${tradeData.scanner_conf}
  Devil's Advocate score: ${tradeData.da_challenge}
  SAA risk score: ${tradeData.saa_risk}
  
WHAT ACTUALLY HAPPENED:
  Price action: ${actualOutcome.price_action_desc}
  Nifty direction: ${actualOutcome.nifty_move}

YOUR TASK — Perform forensic autopsy and recommend weight changes if patterns exist.
Respond ONLY in JSON format.`;

        try {
            const autopsyResult = await aiAgentService.prompt(this.systemPrompt, userPrompt);
            
            // Save to DB
            const savedAutopsy = await TradeAutopsy.create({
                trade_id: tradeData._id,
                ...autopsyResult
            });

            // If a weight change is recommended and justified, create a PENDING LogicRegistry entry
            if (autopsyResult.weight_change_recommendation?.justified) {
                for (const change of autopsyResult.weight_change_recommendation.changes) {
                    await LogicRegistry.create({
                        entry_id: `REG-${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        change_type: 'WEIGHT',
                        affected_agent: change.agent,
                        affected_parameter: `weights.${change.agent}_max`, // Assuming schema mapping
                        old_value: change.current_weight,
                        new_value: change.recommended_weight,
                        triggered_by: 'trade_autopsy',
                        evidence: `Trade ${tradeData.symbol} autopsy: ${autopsyResult.root_cause}`,
                        reasoning: change.reason,
                        approval_status: 'PENDING'
                    });
                }
            }

            return savedAutopsy;
        } catch (error) {
            console.error('[TradeAutopsyService] Error:', error.message);
            throw error;
        }
    }
}

module.exports = new TradeAutopsyService();
