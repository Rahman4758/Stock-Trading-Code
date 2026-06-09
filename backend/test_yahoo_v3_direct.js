const yf = require('yahoo-finance2');

async function test() {
    try {
        console.log('Testing yf.quote directly (proxy check)...');
        // Sometimes Proxies don't show up in Object.keys
        const res = await yf.quote('INR=X');
        console.log('Success with yf.quote!');
    } catch (e) {
        console.log('yf.quote failed:', e.message);
    }

    try {
        console.log('Testing yf.default directly...');
        const res = await yf.default.quote('INR=X');
        console.log('Success with yf.default.quote!');
    } catch (e) {
        console.log('yf.default.quote failed:', e.message);
    }
}

test();
