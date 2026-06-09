const mongoose = require('mongoose');
const { connectMongo } = require('./src/config/db');
const DataIntegrityService = require('./src/services/DataIntegrityService');
const SectorIndex = require('./src/models/SectorIndex');
require('dotenv').config({ path: 'src/.env' });

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function verifyIntegrity() {
    console.log('--- STARTING INTEGRITY VERIFICATION ---');
    
    try {
        await connectMongo();
        
        // 1. Simulate a gap
        // Pick a date from 3 days ago (that isn't a weekend)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 3);
        if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() - 2); // Sun -> Fri
        if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() - 1); // Sat -> Fri
        targetDate.setHours(0,0,0,0);
        
        const dateStr = targetDate.toISOString().split('T')[0];
        console.log(`[Test] Simulating gap for date: ${dateStr}`);
        
        await SectorIndex.deleteOne({ indexName: 'NIFTY50', date: targetDate });
        console.log(`[Test] Deleted NIFTY50 record for ${dateStr}`);

        // 2. Perform Audit
        const gaps = await DataIntegrityService.checkGaps(7);
        console.log(`[Test] Gaps found:`, gaps.missingIndices);

        if (gaps.missingIndices.includes(dateStr)) {
            console.log('[Test] SUCCESS: Gap detected correctly.');
        } else {
            throw new Error('Gap was NOT detected.');
        }

        // 3. Perform Healing
        console.log('[Test] Triggering Auto-Heal...');
        await DataIntegrityService.autoHeal(gaps);

        // 4. Verify healing
        const recovered = await SectorIndex.findOne({ indexName: 'NIFTY50', date: targetDate });
        if (recovered) {
            console.log(`[Test] SUCCESS: Record recovered for ${dateStr}. Close: ${recovered.close}`);
        } else {
            throw new Error('Record was NOT recovered.');
        }

        console.log('\n--- INTEGRITY SYSTEM VERIFIED SUCCESSFULLY ---');
    } catch (err) {
        console.error('\n[Test] VERIFICATION FAILED:', err.message);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

verifyIntegrity();
