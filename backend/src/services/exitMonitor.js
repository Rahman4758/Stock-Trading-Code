const SmartMoneyScore = require('../models/SmartMoneyScore');
const DailyPrice = require('../models/DailyPrice');
const Stock = require('../models/Stock');

class ExitMonitor {
    /**
     * Run daily End-Of-Day to check all OPEN trades against exit triggers
     */
    async evaluateExits(targetDate = new Date()) {
        try {
            // Find all trades still marked OPEN 
            // Technically, since scores are generated daily, an "OPEN" status is mostly useful 
            // on the most recently generated signal that we haven't closed yet.
            const openTrades = await SmartMoneyScore.find({
                'exitMonitoring.status': 'OPEN',
                grade: { $in: ['A+', 'A', 'B'] }
            });

            console.log(`[ExitMonitor] Found ${openTrades.length} OPEN positions to evaluate.`);

            for (const trade of openTrades) {
                await this.checkTriggers(trade, targetDate);
            }
        } catch (err) {
            console.error('[ExitMonitor] Failed to evaluate exits:', err);
        }
    }

    async checkTriggers(trade, targetDate) {
        // Fetch latest price & latest score for this symbol
        const latestPrice = await DailyPrice.findOne({ symbol: trade.symbol, date: { $lte: targetDate } }).sort({ date: -1 }).lean();
        if (!latestPrice) return;

        const latestScore = await SmartMoneyScore.findOne({ symbol: trade.symbol, date: { $lte: targetDate } }).sort({ date: -1 }).lean();
        if (!latestScore) return;

        const curPrice = latestPrice.close;
        const sl = trade.exitMonitoring?.stopLoss;
        const t1 = trade.exitMonitoring?.target1;
        const t2 = trade.exitMonitoring?.target2;

        if (!sl || !t1 || !t2) return; // Skip trades with incomplete exit levels

        let newStatus = 'OPEN';
        let reason = '';

        // EXIT TRIGGER 1: stopLoss hit -> currentPrice <= stopLoss -> EXIT FULL
        if (sl && curPrice <= sl) {
            newStatus = 'CLOSED_SL';
            reason = `Stop Loss hit at ₹${sl}`;
        }
        // EXIT TRIGGER 3: Target2 hit -> currentPrice >= target2 -> EXIT FULL
        else if (t2 && curPrice >= t2) {
            newStatus = 'CLOSED_T2';
            reason = `Target 2 achieved at ₹${t2}`;
        }
        // EXIT TRIGGER 4: Institutional score drops below 60 -> EXIT FULL
        else if (latestScore.compositeScore < 60) {
            newStatus = 'CLOSED_DIST';
            reason = `Institutional score dropped to ${latestScore.compositeScore} (Distribution)`;
        }
        // EXIT TRIGGER 5: Price closes below EMA(50) -> Tighten SL (we won't close, just update DB if needed, or close if strict)
        // Check DailyPrice's sma50 as proxy for EMA50 for simplicity if ema50 isn't saved in DailyPrice
        else if (latestPrice.sma50 && curPrice < latestPrice.sma50) {
            newStatus = 'CLOSED_EMA_BREAK';
            reason = `Price closed below 50-day average at ₹${curPrice}`;
        }
        // EXIT TRIGGER 6: OI Structure turns negative (Short Buildup detected by existing scanner)
        // Score component for OI < 40 indicates heavy shorting
        else if (latestScore.scores?.oiSignal != null && latestScore.scores.oiSignal < 40) {
            newStatus = 'CLOSED_OI_REV';
            reason = `Negative OI structure detected (Score: ${latestScore.scores.oiSignal})`;
        }
        // EXIT TRIGGER 2: Target1 hit -> currentPrice >= target1 -> EXIT 50%
        else if (trade.exitMonitoring?.status !== 'CLOSED_T1' && t1 && curPrice >= t1) {
            // Partial exit. We update status but it remains somewhat "active" or we just mark CLOSED_T1
            newStatus = 'CLOSED_T1'; 
            reason = `Target 1 achieved at ₹${t1}. SL moved to Breakeven.`;
            // Move SL to breakeven (which is assumed pivotPrice or slightly below)
            trade.exitMonitoring.stopLoss = trade.pivotPrice || trade.exitMonitoring.stopLoss;
        }

        // Save if status changed
        if (newStatus !== trade.exitMonitoring?.status) {
            console.log(`[ExitMonitor] ${trade.symbol} Exit Triggered: ${newStatus} - ${reason}`);
            
            await SmartMoneyScore.findByIdAndUpdate(trade._id, {
                $set: {
                    'exitMonitoring.status': newStatus,
                    'exitMonitoring.stopLoss': trade.exitMonitoring.stopLoss, // potentially updated T1 -> BE
                    'flags': [...trade.flags, newStatus] // Optionally push flag to UI
                }
            });
        }
    }
}

module.exports = new ExitMonitor();
