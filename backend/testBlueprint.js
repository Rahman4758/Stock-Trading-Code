const BlueprintGenerator = require('./src/services/BlueprintGenerator');
const NotificationService = require('./src/services/NotificationService');

const mockSnapshot = {
    symbol: "TESTER",
    close_price: 2436.5,
    conviction_score: 85,
    atr14: 48.7 
};

async function testBlueprint() {
    const bp = BlueprintGenerator.generate(mockSnapshot, 1000000); // 10 L
    console.log("Generated Blueprint data object:");
    console.log(JSON.stringify(bp, null, 2));

    console.log("\nTesting notification formatting:");
    await NotificationService.sendAlert(bp);
}

testBlueprint();
