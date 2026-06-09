const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");

async function main() {
    const transport = new SSEClientTransport(new URL("https://mcp.kite.trade/sse"));
    const client = new Client(
        { name: "institutional-edge-sync", version: "1.0.0" },
        { capabilities: { prompts: {}, resources: {}, tools: {} } }
    );
    await client.connect(transport);
    
    const tools = await client.listTools();
    console.log("Tool Names:");
    tools.tools.forEach(t => console.log(t.name));

    console.log("Calling login...");
    const loginRes = await client.callTool({
        name: "login",
        arguments: {}
    });
    console.log("Login Response:", JSON.stringify(loginRes, null, 2));
    
    process.exit(0);
}

main().catch(console.error);
