const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const readline = require('readline');
const mongoose = require('mongoose');
const Portfolio = require('../../src/models/Portfolio'); // depends on how we run it, wait let's use the correct relative path. The script is in src/scripts/mcpSync.js so src/models is one level up
const { connectMongo } = require('../../src/config/db');

// Fix path for requires
const PortfolioModel = require('../models/Portfolio');
const dbConfig = require('../config/db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
    console.log("🚀 Starting Zerodha MCP Sync...");
    
    // Connect DB
    await dbConfig.connectMongo();

    const transport = new SSEClientTransport(new URL("https://mcp.kite.trade/sse"));
    const client = new Client(
        { name: "institutional-edge-sync", version: "1.0.0" },
        { capabilities: { prompts: {}, resources: {}, tools: {} } }
    );
    
    console.log("🔌 Connecting to mcp.kite.trade...");
    await client.connect(transport);
    console.log("✅ Connected securely to Zerodha MCP");

    // Try to get holdings directly
    let holdingsRes = await client.callTool({ name: "get_holdings" });

    if (holdingsRes.isError && holdingsRes.content[0].text.includes("log in first")) {
        console.log("⚠️ Auth required. Generating login link...");
        const loginRes = await client.callTool({ name: "login" });
        
        const loginText = loginRes.content[0].text;
        const urlMatch = loginText.match(/https:\/\/kite.zerodha.com\/connect\/login\S+/);
        
        if (urlMatch) {
            console.log("\n=======================================================");
            console.log("🔗 ACTION REQUIRED: Please log in to your Zerodha Account");
            console.log("=======================================================");
            console.log(urlMatch[0]);
            console.log("=======================================================\n");
            
            await askQuestion("👉 Press ENTER after you have successfully logged in on the browser...");
            
            // Try fetching again
            console.log("🔄 Fetching holdings...");
            holdingsRes = await client.callTool({ name: "get_holdings" });
        } else {
            console.error("❌ Failed to parse login URL from MCP response:", loginText);
            process.exit(1);
        }
    }

    if (holdingsRes.isError) {
        console.error("❌ Error fetching holdings:", holdingsRes.content[0].text);
        process.exit(1);
    }

    // Parse the holdings. The content text is usually a JSON string or formatted text.
    // Let's print it to see its structure first, but let's assume it's JSON text if we try to parse it.
    console.log("✅ Holdings fetched successfully! Syncing to database...");
    
    const holdingsText = holdingsRes.content[0].text;
    let holdingsData;
    try {
        holdingsData = JSON.parse(holdingsText);
    } catch (err) {
        console.log("Raw holdings text:", holdingsText);
        console.error("❌ Failed to parse holdings JSON data.");
        process.exit(1);
    }

    let syncedCount = 0;
    
    if (Array.isArray(holdingsData)) {
        for (const item of holdingsData) {
            // item might have instrument_token, tradingsymbol, quantity, average_price etc.
            if (item.tradingsymbol && item.quantity > 0) {
                await PortfolioModel.findOneAndUpdate(
                    { symbol: item.tradingsymbol.toUpperCase() },
                    {
                        $set: {
                            symbol: item.tradingsymbol.toUpperCase(),
                            quantity: item.quantity,
                            buyPrice: item.average_price,
                            notes: "Synced via Zerodha MCP"
                        }
                    },
                    { upsert: true }
                );
                syncedCount++;
                console.log(`Synced: ${item.tradingsymbol} (${item.quantity} shares)`);
            }
        }
    } else {
        console.log("Unexpected data format:", holdingsData);
    }

    console.log(`\n🎉 Sync Complete! Successfully updated ${syncedCount} stocks in your local portfolio tracker.`);
    console.log("Institutional analysis will now automatically run on these holdings.");
    
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
});
