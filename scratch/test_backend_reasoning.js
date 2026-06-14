async function test() {
    try {
        console.log("Querying local chat API with nvidia/nemotron-3-super-120b-a12b:free...");
        const response = await fetch("http://127.0.0.1:3000/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "nvidia/nemotron-3-super-120b-a12b:free",
                message: "How many r's are in the word 'strawberry'?",
                history: [],
                email: "test@gmail.com"
            })
        });

        if (!response.ok) {
            console.error("HTTP error:", response.status, response.statusText);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let fullText = "";
        while (!done) {
            const { value, done: readDone } = await reader.read();
            done = readDone;
            if (value) {
                const chunk = decoder.decode(value);
                fullText += chunk;
                process.stdout.write(chunk);
            }
        }
        console.log("\n\n--- Done ---");
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

test();
