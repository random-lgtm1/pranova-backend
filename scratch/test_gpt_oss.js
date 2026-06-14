const dotenv = require('dotenv');
dotenv.config();

async function run() {
    try {
        console.log("1. Testing non-streaming reasoning...");
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b:free",
                messages: [
                    { role: "user", content: "How many r's are in the word 'strawberry'?" }
                ],
                reasoning: { enabled: true }
            })
        });

        const json = await response.json();
        console.log("Non-streaming Response:", JSON.stringify(json, null, 2));

        console.log("\n2. Testing streaming reasoning...");
        const responseStream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b:free",
                messages: [
                    { role: "user", content: "How many r's are in the word 'strawberry'?" }
                ],
                reasoning: { enabled: true },
                stream: true
            })
        });

        const reader = responseStream.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let count = 0;
        while (!done && count < 10) {
            const { value, done: readDone } = await reader.read();
            done = readDone;
            if (value) {
                const chunk = decoder.decode(value);
                console.log(`Chunk ${count++}:`, chunk);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
