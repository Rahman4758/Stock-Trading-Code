const ActiveRadar = require('../models/ActiveRadar');
const TradeJournal = require('../models/TradeJournal');

// Paper Trading Config
const PAPER_CAPITAL = 1000000; // 10 Lakhs
const RISK_PER_TRADE_PCT = 0.01; // 1% risk per trade
const RISK_AMOUNT = PAPER_CAPITAL * RISK_PER_TRADE_PCT;

const MAX_RADAR_SIZE = 20;

class RadarManager {
    /**
     * Processes the daily scan results adjusting the ActiveRadar dynamically.
     * @param {Array} scanResults - Array of analysis objects returned from stockSelector.js
     */
    async processDailyRadar(scanResults) {
        if (!scanResults || scanResults.length === 0) return;

        const targetDate = scanResults[0].targetDate;

        // Map scan results by symbol for O(1) matching
        const scanBySymbol = {};
        for (const res of scanResults) {
            scanBySymbol[res.symbol] = res;
        }

        // 1. Process currently TRACKING stocks (Exit Rules & Updates)
        const trackingList = await ActiveRadar.find({ status: 'TRACKING' });

        for (let radar of trackingList) {
            const currentData = scanBySymbol[radar.symbol];
            
            if (!currentData) {
                // Keep it on the radar just in case data was temporarily missing, but increment days
                radar.daysOnRadar += 1;
                await radar.save();
                continue;
            }

            // Update metrics
            radar.daysOnRadar += 1;
            if (currentData.institutionalScore > radar.highestScore) {
                radar.highestScore = currentData.institutionalScore;
            }
            if (currentData.currentPrice > radar.highestPrice) {
                radar.highestPrice = currentData.currentPrice;
            }

            // *** DYNAMIC TRAILING STOP LOSS (Locking Profits) ***
            // Lock in at exactly 4% below the absolute peak high it reached on radar
            const trailingStop = parseFloat((radar.highestPrice * 0.96).toFixed(2));
            if (trailingStop > radar.stopLoss) {
                // Ratchet the stop upwards ONLY (never lower it)
                radar.stopLoss = trailingStop;
            }

            // Dynamically evaluate exit conditions
            let exitReason = null;
            if (currentData.currentPrice < radar.stopLoss) {
                radar.status = 'EXITED_STOP_LOSS';
                exitReason = `Trailing Stop Hit / Broken Support (Price fell below ₹${radar.stopLoss})`;
            } else if (currentData.institutionalScore < 55) {
                radar.status = 'EXITED_SCORE_DECAY';
                exitReason = `Institutional Conviction Decay (Score dropped to ${currentData.institutionalScore})`;
            }

            if (exitReason) {
                radar.exitDate = targetDate;
                radar.exitPrice = currentData.currentPrice;
                radar.exitReason = exitReason;
            }

            await radar.save();
        }

        // 2. Manage New Entrants (Survival of the Fittest Limit)
        
        // Find strong new candidates not already in the tracking list
        const candidates = scanResults.filter(res => 
            res.institutionalScore >= 75 && 
            res.technicalScore >= 70 &&
            !trackingList.find(t => t.symbol === res.symbol)
        );

        // Sort candidates by finalScore descending (best first)
        candidates.sort((a, b) => b.finalScore - a.finalScore);

        for (const candidate of candidates) {
            // Re-fetch current TRACKING list because its size might have changed in loop
            const currentTracking = await ActiveRadar.find({ status: 'TRACKING' });

            if (currentTracking.length < MAX_RADAR_SIZE) {
                // Plenty of room, insert new setup
                const stopLossPrice = candidate.levels?.stopLoss || (candidate.currentPrice * 0.95);
                const targetPrice1 = candidate.levels?.target1 || (candidate.currentPrice * 1.05);
                const targetPrice2 = candidate.levels?.target2 || (candidate.currentPrice * 1.10);

                await ActiveRadar.create({
                    symbol: candidate.symbol,
                    entryDate: targetDate,
                    entryPrice: candidate.currentPrice,
                    entryInstScore: candidate.institutionalScore,
                    entryTechScore: candidate.technicalScore,
                    highestScore: candidate.institutionalScore,
                    highestPrice: candidate.currentPrice,
                    stopLoss: stopLossPrice,
                    targetPrice: targetPrice1,
                    status: 'TRACKING',
                    daysOnRadar: 1
                });

                // PAPER TRADING: Auto-execute the trade
                const riskDistance = candidate.currentPrice - stopLossPrice;
                let quantity = 0;
                if (riskDistance > 0) {
                    quantity = Math.floor(RISK_AMOUNT / riskDistance);
                } else {
                    quantity = Math.floor(RISK_AMOUNT / (candidate.currentPrice * 0.05)); // Fallback 5% risk
                }

                await TradeJournal.create({
                    symbol: candidate.symbol,
                    sector: 'AUTO_SCAN',
                    status: 'OPEN',
                    entry_date: targetDate,
                    entry_price: candidate.currentPrice,
                    stop_loss: stopLossPrice,
                    target1: targetPrice1,
                    target2: targetPrice2,
                    quantity: quantity,
                    capital_deployed: quantity * candidate.currentPrice,
                    risk_amount: RISK_AMOUNT,
                    trade_type: 'AUTO',
                    strategy_name: candidate.setupType || 'SYSTEM_AUTO',
                    conviction_score_at_entry: candidate.finalScore,
                    entry_reason: `Auto-traded due to high conviction (${candidate.finalScore}) and A/A+ grade.`
                });
            } else {
                // Radar is FULL - "Survival of the fittest"
                let weakestRadar = null;
                let lowestScore = Infinity;

                for (const tracked of currentTracking) {
                    const tData = scanBySymbol[tracked.symbol];
                    const tScore = tData ? tData.finalScore : 0; 
                    if (tScore < lowestScore) {
                        lowestScore = tScore;
                        weakestRadar = tracked;
                    }
                }

                // If candidate is stronger than the weakest stock, kick weakest out
                if (weakestRadar && candidate.finalScore > lowestScore) {
                    weakestRadar.status = 'REPLACED';
                    weakestRadar.exitDate = targetDate;
                    weakestRadar.exitPrice = scanBySymbol[weakestRadar.symbol]?.currentPrice || weakestRadar.entryPrice;
                    weakestRadar.exitReason = `Replaced by stronger institutional setup: ${candidate.symbol}`;
                    await weakestRadar.save();

                    const stopLossPrice = candidate.levels?.stopLoss || (candidate.currentPrice * 0.95);
                    const targetPrice1 = candidate.levels?.target1 || (candidate.currentPrice * 1.05);
                    const targetPrice2 = candidate.levels?.target2 || (candidate.currentPrice * 1.10);

                    // Insert the new strong candidate
                    await ActiveRadar.create({
                        symbol: candidate.symbol,
                        entryDate: targetDate,
                        entryPrice: candidate.currentPrice,
                        entryInstScore: candidate.institutionalScore,
                        entryTechScore: candidate.technicalScore,
                        highestScore: candidate.institutionalScore,
                        highestPrice: candidate.currentPrice,
                        stopLoss: stopLossPrice,
                        targetPrice: targetPrice1,
                        status: 'TRACKING',
                        daysOnRadar: 1
                    });

                    // PAPER TRADING: Auto-execute the trade
                    const riskDistance = candidate.currentPrice - stopLossPrice;
                    let quantity = 0;
                    if (riskDistance > 0) {
                        quantity = Math.floor(RISK_AMOUNT / riskDistance);
                    } else {
                        quantity = Math.floor(RISK_AMOUNT / (candidate.currentPrice * 0.05)); // Fallback 5% risk
                    }

                    await TradeJournal.create({
                        symbol: candidate.symbol,
                        sector: 'AUTO_SCAN',
                        status: 'OPEN',
                        entry_date: targetDate,
                        entry_price: candidate.currentPrice,
                        stop_loss: stopLossPrice,
                        target1: targetPrice1,
                        target2: targetPrice2,
                        quantity: quantity,
                        capital_deployed: quantity * candidate.currentPrice,
                        risk_amount: RISK_AMOUNT,
                        trade_type: 'AUTO',
                        strategy_name: candidate.setupType || 'SYSTEM_AUTO',
                        conviction_score_at_entry: candidate.finalScore,
                        entry_reason: `Auto-traded due to replacing weaker stock. Conviction: ${candidate.finalScore}`
                    });
                }
            }
        }
    }
}

module.exports = new RadarManager();
