const dotenv = require('dotenv');
dotenv.config();

async function run() {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "nvidia/nemotron-3.5-content-safety:free",
                messages: [
                    { role: "user", content: "How many r's are in the word 'strawberry'?" },
                    { 
                        role: "assistant", 
                        content: "User Safety: safe",
                        reasoning_details: [
                            {
                                type: "reasoning.text",
                                text: "Counting r's in strawberry is safe.",
                                format: "unknown",
                                index: 0
                            }
                        ]
                    },
                    { role: "user", content: "Are you sure? Think carefully." }
                ],
                reasoning: { enabled: true }
            })
        });

        console.log("Status:", response.status);
        const json = await response.json();
        console.log("Response:", JSON.stringify(json, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
