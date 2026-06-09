const { quote, historical } = require('yahoo-finance2');

async function test() {
    try {
        console.log('Testing named exports...');
        if (quote) console.log('quote function exists');
        if (historical) console.log('historical function exists');
        
        const result = await quote('INR=X');
        console.log('Success! Price:', result.regularMarketPrice);
    } catch (e) {
        console.log('Error:', e.message);
    }
}

test();
