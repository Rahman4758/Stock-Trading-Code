const yf = require('yahoo-finance2');

async function test() {
    console.log('yf keys:', Object.keys(yf));
    if (yf.default) console.log('yf.default keys:', Object.keys(yf.default));

    try {
        console.log('\nTrying yf.quote()...');
        await yf.quote('INR=X');
        console.log('yf.quote Success!');
    } catch (e) {
        console.log('yf.quote Error:', e.message);
    }

    try {
        console.log('\nTrying yf.default.quote()...');
        await yf.default.quote('INR=X');
        console.log('yf.default.quote Success!');
    } catch (e) {
        console.log('yf.default.quote Error:', e.message);
    }
}

test();
