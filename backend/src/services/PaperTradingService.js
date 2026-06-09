const PaperPortfolioState = require('../models/paper/PaperPortfolioState');
const PaperPosition = require('../models/paper/PaperPosition');
const PaperTrade = require('../models/paper/PaperTrade');
const PaperSignal = require('../models/paper/PaperSignal');
const { PaperEquityCurve, PaperMonthlyStats } = require('../models/paper/PaperPerformance');

class PaperTradingService {
    /**
     * Process an incoming signal from the Coordinator Agent.
     * Implements Section 2.1 & 2.2 selection logic.
     */
    async processSignal(signalPayload) {
        console.log(`[PaperTrading] Processing signal for ${signalPayload.symbol}`);
        
        const state = await this.getPortfolioState();
        if (!state.is_active) return { selected: false, reason: 'SYSTEM_INACTIVE' };

        // 1. Run Selection Filters (Section 2.2)
        const filterResult = await this.runSelectionFilters(signalPayload, state);
        
        // 2. Log Signal (Section 4.3)
        const paperSignal = await PaperSignal.create({
            ...signalPayload,
            selection_status: filterResult.status,
            filter_reason: filterResult.reason
        });

        if (filterResult.status !== 'IN_PORTFOLIO') {
            return { selected: false, reason: filterResult.reason };
        }

        // 3. Calculate Position Size (Section 2.3)
        const sizeData = this.calculatePositionSize(signalPayload, state);
        
        // 4. Open Paper Position (Section 3.1)
        const tradeId = `PT${Date.now().toString().slice(-6)}`;
        const paperPosition = await PaperPosition.create({
            trade_id: tradeId,
            signal_id: signalPayload.signal_id,
            symbol: signalPayload.symbol,
            trade_type: signalPayload.trade_type,
            direction: signalPayload.direction,
            entry_price: signalPayload.entry_price,
            initial_sl: signalPayload.sl_price,
            current_sl: signalPayload.sl_price,
            t1_price: signalPayload.t1_price,
            t2_price: signalPayload.t2_price,
            t3_price: signalPayload.t3_price,
            qty_total: sizeData.quantity,
            qty_remaining: sizeData.quantity,
            allocated_capital: sizeData.allocated,
            total_invested: sizeData.invested,
            conviction_score: signalPayload.conviction_score,
            devil_score: signalPayload.devil_advocate_score,
            agent_signals: signalPayload.agent_signals
        });

        // 5. Update Portfolio Cash
        state.current_cash -= sizeData.invested;
        state.last_updated = new Date();
        await state.save();

        paperSignal.linked_trade_id = tradeId;
        await paperSignal.save();

        console.log(`[PaperTrading] Position OPENED: ${signalPayload.symbol} x ${sizeData.quantity} (TradeID: ${tradeId})`);
        return { selected: true, trade_id: tradeId };
    }

    /**
     * Update LTP for an active symbol and check triggers.
     * Implements Section 3.2 - 3.6
     */
    async updatePositionLTP(symbol, ltp) {
        const pos = await PaperPosition.findOne({ symbol, status: 'OPEN' });
        if (!pos) return null;

        pos.last_price_update = ltp;
        pos.last_price_time = new Date();

        // Update P&L
        if (pos.direction === 'LONG') {
            pos.unrealized_pnl = (ltp - pos.entry_price) * pos.qty_remaining;
        } else {
            pos.unrealized_pnl = (pos.entry_price - ltp) * pos.qty_remaining;
        }

        // Check Exit Triggers
        let closed = false;
        
        // 1. Stop Loss Check
        const isSlHit = pos.direction === 'LONG' ? ltp <= pos.current_sl : ltp >= pos.current_sl;
        if (isSlHit) {
            await this.closePosition(pos, pos.current_sl, 'SL_HIT', 'Stop loss hit at ' + pos.current_sl);
            closed = true;
        }
        // 2. Target 3 Check (Full Exit)
        else if ((pos.direction === 'LONG' && ltp >= pos.t3_price) || (pos.direction === 'SHORT' && ltp <= pos.t3_price)) {
            await this.closePosition(pos, pos.t3_price, 'TARGET_T3', 'Final target reached');
            closed = true;
        }
        // 3. Target 2 Check (Partial 40%)
        else if (pos.qty_booked_t2 === 0 && ((pos.direction === 'LONG' && ltp >= pos.t2_price) || (pos.direction === 'SHORT' && ltp <= pos.t2_price))) {
            await this.handlePartialBooking(pos, ltp, 'T2_HIT');
        }
        // 4. Target 1 Check (Partial 40%)
        else if (pos.qty_booked_t1 === 0 && ((pos.direction === 'LONG' && ltp >= pos.t1_price) || (pos.direction === 'SHORT' && ltp <= pos.t1_price))) {
            await this.handlePartialBooking(pos, ltp, 'T1_HIT');
        }

        if (!closed) await pos.save();
        return { closed };
    }

    async runSelectionFilters(signal, state) {
        // RULE 1: Min Conviction
        const minConv = signal.trade_type === 'INTRADAY' ? 70 : 72;
        if (signal.conviction_score < minConv) return { status: 'FILTERED_LOW_CONVICTION', reason: `Conviction ${signal.conviction_score} below ${minConv}` };

        // RULE 2: Devil Hard Reject
        if (signal.devil_advocate_score >= 8) return { status: 'FILTERED_DEVIL_REJECT', reason: `Devil Score ${signal.devil_advocate_score} too high` };

        // RULE 3: Max Positions
        const openCount = await PaperPosition.countDocuments({ status: 'OPEN' });
        if (openCount >= state.max_positions_allowed) return { status: 'FILTERED_MAX_POSITIONS', reason: 'Open limit reached' };

        // RULE 5: SAA Check (Fallback)
        if (signal.agent_signals?.saa_risk_score >= 8) return { status: 'FILTERED_SAA_HIGH', reason: 'Systemic risk high' };

        return { status: 'IN_PORTFOLIO', reason: 'OK' };
    }

    calculatePositionSize(signal, state) {
        const base = state.max_capital_per_position;
        let adj = 1.0;
        const da = signal.devil_advocate_score;

        if (da <= 3) adj = 1.0;
        else if (da <= 5) adj = 0.75;
        else if (da === 6) adj = 0.50;
        else if (da === 7) adj = 0.40;

        const allocated = base * adj;
        const qty = Math.floor(allocated / signal.entry_price);
        return {
            quantity: qty,
            allocated,
            invested: qty * signal.entry_price
        };
    }

    async handlePartialBooking(pos, price, eventName) {
        const bookingQty = Math.floor(pos.qty_total * 0.40);
        const pnl = (price - pos.entry_price) * (pos.direction === 'LONG' ? 1 : -1) * bookingQty;

        pos.realized_pnl += pnl;
        pos.qty_remaining -= bookingQty;
        
        let newSl = pos.current_sl;
        if (eventName === 'T1_HIT') {
            pos.qty_booked_t1 = bookingQty;
            newSl = pos.entry_price; // Trail to Breakeven
        } else if (eventName === 'T2_HIT') {
            pos.qty_booked_t2 = bookingQty;
            newSl = pos.t1_price; // Trail to T1
        }

        pos.current_sl = newSl;
        pos.booking_log.push({
            event: eventName,
            price: price,
            qty: bookingQty,
            pnl: pnl,
            new_sl: newSl
        });

        console.log(`[PaperTrading] PARTIAL BOOKING: ${pos.symbol} ${eventName} at ${price}. New SL: ${newSl}`);
    }

    async closePosition(pos, exitPrice, exitType, reason) {
        const finalPnl = pos.realized_pnl + (exitPrice - pos.entry_price) * (pos.direction === 'LONG' ? 1 : -1) * pos.qty_remaining;
        const pnlPct = parseFloat(((finalPnl / pos.total_invested) * 100).toFixed(2));

        pos.status = 'CLOSED';
        
        await PaperTrade.create({
            trade_id: pos.trade_id,
            signal_id: pos.signal_id,
            symbol: pos.symbol,
            trade_type: pos.trade_type,
            direction: pos.direction,
            entry_date: pos.entry_date,
            exit_date: new Date(),
            entry_price: pos.entry_price,
            exit_price: exitPrice,
            exit_type: exitType,
            exit_reason: reason,
            qty_total: pos.qty_total,
            allocated_capital: pos.allocated_capital,
            total_invested: pos.total_invested,
            total_pnl: finalPnl,
            pnl_pct: pnlPct,
            conviction_score: pos.conviction_score,
            devil_score: pos.devil_score,
            agent_signals: pos.agent_signals,
            booking_log: pos.booking_log
        });

        // Update Portfolio State
        const state = await this.getPortfolioState();
        state.current_cash += (exitPrice * pos.qty_remaining) + (pos.qty_total - pos.qty_remaining) * pos.entry_price; // Approximate cash back
        // In paper trading, we just restore the cash + net realized pnl
        state.total_realized_pnl += finalPnl;
        await state.save();

        await pos.deleteOne();
        console.log(`[PaperTrading] TRADE CLOSED: ${pos.symbol} via ${exitType}. PnL: ${finalPnl}`);
    }

    async getPortfolioState() {
        let state = await PaperPortfolioState.findOne();
        if (!state) {
            state = await PaperPortfolioState.create({ starting_capital: 500000, current_cash: 500000 });
        }
        return state;
    }
}

module.exports = new PaperTradingService();
