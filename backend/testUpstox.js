require('dotenv').config({ path: 'src/.env' });
const axios = require('axios');

async function testFetch() {
    console.log("Direct API Test for Search API...");
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
    
    try {
        const searchRes = await axios.get('https://api.upstox.com/v1/instruments/search', {
            params: { query: 'HDFCBANK', segments: 'EQ' },
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log("Search Response:");
        console.log(JSON.stringify(searchRes.data, null, 2));

    } catch (e) {
        console.error("Test failed!");
        if (e.response && e.response.data) {
            console.error("Upstox Error Body:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error:", e.message);
        }
    }
}

testFetch();
