const TradeJournal = require('../models/TradeJournal');
const Stock = require('../models/Stock');

class PortfolioManager {
    constructor() {
        this.portfolioCapital = 1000000; // Default 10 Lac
        this.maxSectorExposurePct = 0.15; // 15%
    }

    /**
     * Set the current total portfolio capital.
     */
    setPortfolioCapital(capital) {
        this.portfolioCapital = capital;
    }

    /**
     * Calculate current active exposure risk and sector limits.
     * @returns {Object} Exposure metrics
     */
    async calculateExposure() {
        const openTrades = await TradeJournal.find({ status: 'OPEN' }).lean();
        
        let totalDeployed = 0;
        let totalRisk = 0;
        const sectorExposure = {};

        for (const trade of openTrades) {
            totalDeployed += trade.capital_deployed;
            totalRisk += trade.risk_amount;
            
            if (!sectorExposure[trade.sector]) {
                sectorExposure[trade.sector] = 0;
            }
            sectorExposure[trade.sector] += trade.capital_deployed;
        }

        const stats = {
            total_capital: this.portfolioCapital,
            deployed_capital: totalDeployed,
            free_cash: this.portfolioCapital - totalDeployed,
            total_risk: totalRisk,
            risk_pct: parseFloat(((totalRisk / this.portfolioCapital) * 100).toFixed(2)),
            sector_breakdown: {}
        };

        Object.keys(sectorExposure).forEach(sector => {
            const expCapital = sectorExposure[sector];
            const expPct = parseFloat(((expCapital / this.portfolioCapital) * 100).toFixed(2));
            stats.sector_breakdown[sector] = {
                capital: expCapital,
                pct: expPct,
                is_over_limit: expPct > (this.maxSectorExposurePct * 100)
            };
        });

        return stats;
    }

    /**
     * Pre-trade check: Ensure new entry does not breach sector limits.
     * @param {string} symbol 
     * @param {string} sector 
     * @param {number} proposedCapital 
     */
    async canDeploy(symbol, sector, proposedCapital) {
        const stats = await this.calculateExposure();
        
        if (stats.free_cash < proposedCapital) {
            return { allowed: false, reason: 'Insufficient free cash' };
        }
        
        const currentSectorExp = stats.sector_breakdown[sector] ? stats.sector_breakdown[sector].pct : 0;
        const proposedSectorExp = ((proposedCapital) / this.portfolioCapital) * 100;
        
        if (currentSectorExp + proposedSectorExp > (this.maxSectorExposurePct * 100)) {
            return { 
                allowed: false, 
                reason: `Adding ${proposedSectorExp.toFixed(1)}% to ${sector} breaches the 15% maximum sector limit (currently at ${currentSectorExp}%)` 
            };
        }

        return { allowed: true, reason: 'OK' };
    }

    /**
     * Submit a trade to the journal.
     */
    async logTradeEntry(blueprintInfo, executionPrice) {
        const newTrade = new TradeJournal({
            symbol: blueprintInfo.symbol,
            sector: blueprintInfo.sector || 'UNKNOWN',
            status: 'OPEN',
            entry_price: executionPrice,
            stop_loss: blueprintInfo.stop_loss,
            quantity: blueprintInfo.position_size.recommended_shares,
            capital_deployed: executionPrice * blueprintInfo.position_size.recommended_shares,
            risk_amount: blueprintInfo.position_size.risk_amount_inr,
            event_type: blueprintInfo.event_type || 'Event',
            conviction_score_at_entry: blueprintInfo.conviction_score || 0
        });
        
        await newTrade.save();
        return newTrade;
    }

    /**
     * Mark an open trade as closed and record final PnL.
     */
    async logTradeExit(symbol, executionPrice, notes = "") {
        const trade = await TradeJournal.findOne({ symbol, status: 'OPEN' });
        if (!trade) return null;

        const pnl = (executionPrice - trade.entry_price) * trade.quantity;
        const pnlPct = parseFloat((((executionPrice - trade.entry_price) / trade.entry_price) * 100).toFixed(2));

        trade.exit_price = executionPrice;
        trade.exit_date = new Date();
        trade.pnl_absolute = pnl;
        trade.pnl_percentage = pnlPct;
        trade.status = 'CLOSED';
        trade.notes = notes;

        await trade.save();

        // AGENT 11: Trade Autopsy Integration
        try {
            const TradeAutopsyService = require('./TradeAutopsyService');
            console.log(`[Autopsy] Running forensic analysis for closed trade ${symbol}...`);
            await TradeAutopsyService.analyze(trade, {
                status: pnl >= 0 ? 'WIN' : 'LOSS',
                pnl,
                r_multiple: parseFloat((pnl / trade.risk_amount).toFixed(2)),
                price_action_desc: notes || "Trade closed at target/SL",
                nifty_move: "Market neutral" // Default fallback
            });
        } catch (e) {
            console.error('[Autopsy] Post-trade analysis failed:', e.message);
        }

        return trade;
    }
}

module.exports = new PortfolioManager();
