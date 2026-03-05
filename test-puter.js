// Test all Puter models
const models = [
  "claude-sonnet-4-6",
  "claude-opus-4-6", 
  "claude-haiku-4-5",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.0-flash",
  "llama-3.3-70b",
  "mistral-large",
  "deepseek-chat"
];

async function testModel(model) {
  try {
    const response = await fetch("https://api.puter.com/drivers/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interface: "puter-chat-completion",
        driver: model,
        method: "complete",
        args: { messages: [{ role: "user", content: "Say OK" }] }
      })
    });
    
    const data = await response.json();
    const content = data.message?.content?.[0]?.text || data.text || "";
    return { model, success: true, response: content };
  } catch (error) {
    return { model, success: false, error: error.message };
  }
}

async function testAll() {
  console.log("Testing all Puter models...\n");
  for (const model of models) {
    const result = await testModel(model);
    if (result.success) {
      console.log(`✅ ${model}: ${result.response}`);
    } else {
      console.log(`❌ ${model}: ${result.error}`);
    }
  }
}

testAll();
