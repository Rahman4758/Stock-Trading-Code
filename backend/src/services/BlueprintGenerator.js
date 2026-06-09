/**
 * Trade Blueprint Generator
 * Implements Section 5 of v2.0 Specification
 * Calculates exact mathematical parameters for trade scaling, SL, and Profit taking.
 */
class BlueprintGenerator {
    /**
     * @param {Object} stockData Latest DailySnapshot data + ATR data
     * @param {Number} portfolioCapital Assuming default risk capital
     * @param {Number} riskMultiplier Scaling factor from Devil's Advocate (0.0 - 1.0)
     */
    static generate(stockData, portfolioCapital = 1000000, riskMultiplier = 1.0) { // 10 Lac default portfolio
        const entryPrice = stockData.close_price;
        const atr14 = stockData.atr14 || (entryPrice * 0.02); // fallback to 2% if ATR missing
        
        // Entry calculation
        const entryHigh = parseFloat((entryPrice * 1.003).toFixed(2));
        const entryLow = parseFloat((entryPrice * 0.997).toFixed(2));
        
        // Stop loss calculation (1.5 * ATR)
        const stopLoss = parseFloat((entryPrice - (1.5 * atr14)).toFixed(2));
        const riskPerShare = entryPrice - stopLoss;
        
        // Target calculation
        const target1 = parseFloat((entryPrice * 1.03).toFixed(2)); // +3%
        const target2 = parseFloat((entryPrice * 1.06).toFixed(2)); // +6%
        const target3 = parseFloat((entryPrice * 1.10).toFixed(2)); // +10%
        
        // Position Sizing
        const baseRisk = portfolioCapital * 0.01; // Base 1% risk
        const riskAmount = baseRisk * riskMultiplier;
        const quantity = Math.max(1, Math.floor(riskAmount / riskPerShare));
        const actualAllocation = parseFloat(((quantity * entryPrice) / portfolioCapital * 100).toFixed(2));
        
        // Enforce max 5% allocation rule
        let finalQuantity = quantity;
        if (actualAllocation > 5.0) {
            finalQuantity = Math.floor((portfolioCapital * 0.05) / entryPrice);
        }

        return {
            symbol: stockData.symbol,
            signal: stockData.conviction_score >= 80 ? 'STRONG BUY' : (stockData.conviction_score >= 70 ? 'BUY' : 'WATCH'),
            entry_zone: `${entryLow} - ${entryHigh}`,
            ideal_entry: entryPrice,
            stop_loss: stopLoss,
            targets: {
                T1_40pct: target1,
                T2_40pct: target2,
                T3_20pct: target3
            },
            position_size: {
                recommended_shares: finalQuantity,
                risk_amount_inr: Math.round(finalQuantity * riskPerShare),
                portfolio_allocation_pct: ((finalQuantity * entryPrice) / portfolioCapital * 100).toFixed(2)
            },
            rules: [
                "Enter 50% at ideal entry, 50% on dips closer to lower band.",
                "Mandatory full exit if daily candle closes below SL.",
                "Trail SL to breakeven after hitting T1."
            ]
        };
    }
}

module.exports = BlueprintGenerator;
