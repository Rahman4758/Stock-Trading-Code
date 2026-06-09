const yf1 = require('yahoo-finance2');
const yf2 = require('yahoo-finance2').default;

async function debug() {
    console.log('yf1 keys:', Object.keys(yf1));
    if (yf2) console.log('yf2 keys:', Object.keys(yf2));

    try {
        const symbol = 'INR=X';
        console.log(`\nTesting yf1 for ${symbol}...`);
        const quote1 = await yf1.quote(symbol);
        console.log('yf1 Quote success!');
    } catch (err) {
        console.error('yf1 Error:', err.message);
    }

    try {
        const symbol = 'INR=X';
        console.log(`\nTesting yf2 for ${symbol}...`);
        const quote2 = await yf2.quote(symbol);
        console.log('yf2 Quote success!');
    } catch (err) {
        console.error('yf2 Error:', err.message);
    }
}

debug();
