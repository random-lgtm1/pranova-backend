const dotenv = require('dotenv');
dotenv.config();
const { OpenAI } = require("openai");

const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY
});

async function run() {
    try {
        console.log("Testing stream with OpenAI Node SDK...");
        const stream = await openRouterClient.chat.completions.create({
            model: "openai/gpt-oss-120b:free",
            messages: [
                { role: "user", content: "How many r's are in the word 'strawberry'?" }
            ],
            reasoning: { enabled: true },
            stream: true
        });

        let count = 0;
        for await (const chunk of stream) {
            if (count < 15) {
                console.log(`Chunk ${count++}:`, JSON.stringify(chunk, null, 2));
            } else {
                break;
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
