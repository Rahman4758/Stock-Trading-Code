const yf = require('yahoo-finance2').default;

async function test() {
    try {
        console.log('Attempting quote directly...');
        // The error might be because I'm passing an array and the library 
        // in this version expects a string for single or something?
        // No, symbolsList is an array of strings.
        const quote = await yf.quote('INR=X');
        console.log('Success!');
    } catch (e) {
        console.log('Error caught:', e.message);
        if (e.stack) console.log(e.stack);
    }
}

test();
