const PaperPosition = require('../models/paper/PaperPosition');
const PaperTradingService = require('./PaperTradingService');
const DataSourceManager = require('../collectors/dataSourceManager');

class PaperPriceUpdater {
    /**
     * Main ticker function called by cron every minute.
     */
    async tick() {
        try {
            const activePositions = await PaperPosition.find({ status: 'OPEN' }).lean();
            if (activePositions.length === 0) return;

            const symbols = [...new Set(activePositions.map(p => p.symbol))];
            console.log(`[PaperTicker] Checking prices for: ${symbols.join(', ')}`);

            const dataSource = new DataSourceManager('nse'); // Default to NSE scraper
            const prices = await dataSource.fetchLtpOnly(symbols);
            await dataSource.close();

            for (const symbol of symbols) {
                const ltp = prices[symbol];
                if (ltp) {
                    await PaperTradingService.updatePositionLTP(symbol, ltp);
                } else {
                    console.warn(`[PaperTicker] Could not get price for ${symbol}`);
                }
            }
        } catch (err) {
            console.error('[PaperTicker] Error during price update tick:', err.message);
        }
    }

    /**
     * Mandatory exit for intraday at 3:15 PM
     */
    async runIntradayForceClose() {
        const positions = await PaperPosition.find({ status: 'OPEN', trade_type: 'INTRADAY' });
        if (positions.length === 0) return;

        console.log(`[PaperTicker] Force closing ${positions.length} intraday positions (3:15 PM)`);
        
        const symbols = positions.map(p => p.symbol);
        const dataSource = new DataSourceManager('nse');
        const prices = await dataSource.fetchLtpOnly(symbols);
        await dataSource.close();

        for (const pos of positions) {
            const ltp = prices[pos.symbol] || pos.last_price_update || pos.entry_price;
            await PaperTradingService.closePosition(pos, ltp, 'TIME_EXIT', 'Intraday mandatory exit at 3:15 PM');
        }
    }
}

module.exports = new PaperPriceUpdater();
