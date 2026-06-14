async function test() {
    try {
        console.log("Querying reverted image generation API...");
        const response = await fetch("http://127.0.0.1:3000/api/generate-image", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: "a simple green circle"
            })
        });

        console.log("Response status:", response.status);
        const text = await response.text();
        console.log("Response text:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

test();
