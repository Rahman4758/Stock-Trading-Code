const axios = require('axios');

/**
 * Notification Service
 * Dispatches alerts via Webhook/Telegram format
 */
class NotificationService {
    constructor() {
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || null;
        this.telegramToken = process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    }

    async sendAlert(blueprint) {
        const message = this.formatMessage(blueprint);
        
        // In local development or missing keys, just log beautifully to the terminal
        console.log("==========================================");
        console.log(`🔔 NEW TRADE SIGNAL: ${blueprint.symbol}`);
        console.log(message);
        console.log("==========================================");

        if (this.webhookUrl) {
            try {
                await axios.post(this.webhookUrl, { content: `**Institutional Algo Alert**\n\`\`\`text\n${message}\n\`\`\`` });
            } catch(e) { /* ignore network error on webhook */ }
        }

        if (this.telegramToken && this.chatId) {
            const tgUrl = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
            try {
                await axios.post(tgUrl, {
                    chat_id: this.chatId,
                    text: `*🚨 Institutional Algo Alert*\n\n${message}`,
                    parse_mode: 'Markdown'
                });
            } catch(e) { /* ignore network error on telegram */ }
        }
    }

    formatMessage(bp) {
        return `
[ ${bp.signal} ] : ${bp.symbol}
------------------------
Entry Zone : ₹${bp.entry_zone}
Stop Loss  : ₹${bp.stop_loss}
Targets    : T1=₹${bp.targets.T1_40pct} | T2=₹${bp.targets.T2_40pct} | T3=₹${bp.targets.T3_20pct}
Capital    : ~${bp.position_size.portfolio_allocation_pct}% Allocation (${bp.position_size.recommended_shares} shares)
Rules      : Trail SL to breakeven after T1.
        `.trim();
    }
}

module.exports = new NotificationService();
