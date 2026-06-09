class SignalFreshness {
    /**
     * Apply time-decay to raw component scores based on signal age.
     * Older signals lose their weight.
     * @param {string} signalType - Type of the signal (e.g. 'BULK_DEAL_TIER1')
     * @param {Date} signalDate - When the signal occurred
     * @param {number} rawScore - The pre-decay score to apply the weight to
     */
    applyDecay(signalType, signalDate, rawScore) {
        // No decay if the score is completely neutral
        if (rawScore === 50) return rawScore;

        const now = new Date();
        const ageHours = (now - new Date(signalDate)) / (1000 * 60 * 60);

        let decayMultiplier = 1.0;

        switch (signalType) {
            case 'BULK_DEAL_TIER1':
                // Smart money deals valid for 96 hours (4 days), linear decay
                decayMultiplier = Math.max(0, 1 - (ageHours / 96));
                break;
            case 'FII_FLOW':
                // Daily net flow valid for 48 hours
                decayMultiplier = Math.max(0, 1 - (ageHours / 48));
                break;
            case 'OI_BUILDUP':
                // Option/Futures position buildup valid longer (e.g. till next expiry), slow decay 240 hrs (10 days)
                decayMultiplier = Math.max(0, 1 - (Math.pow(ageHours / 240, 2))); // Non-linear
                break;
            case 'TECHNICAL_BREAKOUT':
                // Tech breakouts fade fast if they don't move (12-24 hours)
                decayMultiplier = Math.max(0, 1 - (ageHours / 24));
                break;
            default:
                decayMultiplier = 1.0;
        }

        // Return score decayed towards 50 (neutral)
        const deviationFromNeutral = rawScore - 50;
        return parseFloat((50 + (deviationFromNeutral * decayMultiplier)).toFixed(2));
    }
}

module.exports = new SignalFreshness();
