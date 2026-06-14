require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
    console.error("REPLICATE_API_TOKEN is missing in .env!");
    process.exit(1);
}

async function test() {
    const prompt = "A simple red ball on a blue background";
    console.log(`Testing prompt: "${prompt}"`);
    console.log("Sending prediction request...");
    
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
            "Authorization": `Token ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            version: "black-forest-labs/flux-schnell",
            input: {
                prompt: prompt
            }
        })
    });
    
    if (!createRes.ok) {
        console.error("Failed to create prediction:", await createRes.text());
        process.exit(1);
    }
    
    let prediction = await createRes.json();
    const pollUrl = prediction.urls.get;
    console.log(`Prediction successfully created (ID: ${prediction.id}).`);
    
    let attempts = 0;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
        console.log(`Attempt ${attempts + 1}: Status is ${prediction.status}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        const pollRes = await fetch(pollUrl, {
            headers: {
                "Authorization": `Token ${token}`
            }
        });
        prediction = await pollRes.json();
    }
    
    console.log(`Final status: ${prediction.status}`);
    if (prediction.status === "succeeded") {
        console.log(`Output Image URL: ${prediction.output[0]}`);
        console.log("✅ Replicate API verification successful!");
    } else {
        console.error(`Prediction failed: ${prediction.error}`);
    }
}

test();
