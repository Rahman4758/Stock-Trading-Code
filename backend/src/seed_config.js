const mongoose = require('mongoose');
const dns = require('dns');
const SystemConfig = require('./models/SystemConfig');

// Force Google DNS to fix Windows SRV lookup issue with mongodb+srv://
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: __dirname + '/.env' });

const seedConfig = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const existing = await SystemConfig.findOne({ config_id: 'current_weights' });
        if (existing) {
            console.log('SystemConfig already exists. Skipping seed.');
        } else {
            await SystemConfig.create({
                config_id: 'current_weights',
                weights: {
                    fii_score_max: 25,
                    dii_score_max: 20,
                    pcr_score_max: 20,
                    deliv_score_max: 15,
                    fundamental_score_max: 10
                },
                thresholds: {
                    scanner_min_confidence: 0.70,
                    da_reject_threshold: 7,
                    da_reduce_size_threshold: 6
                },
                pre_market_rules: {
                    gap_up_cancel_pct: 1.8,
                    gap_down_cancel_pct: 1.5,
                    nifty_open_cancel_pct: 0.8
                },
                last_updated_by: 'system_seed'
            });
            console.log('Default SystemConfig seeded successfully.');
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
};

seedConfig();
