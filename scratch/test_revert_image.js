async function test() {
    try {
        console.log("Querying reverted image generation API...");
        const response = await fetch("https://pranova-api.onrender.com/api/generate-image", {
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
