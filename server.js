require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");
const { GoogleGenAI } = require('@google/genai');
const google = require('googlethis');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');

const USERS_FILE = path.join(__dirname, 'users.json');
const CHATS_FILE = path.join(__dirname, 'chats.json');

// Helper to load users from file synchronously at startup
function loadUsers() {
    try {
        if (fsSync.existsSync(USERS_FILE)) {
            const data = fsSync.readFileSync(USERS_FILE, 'utf8').trim();
            if (data) {
                return new Map(JSON.parse(data));
            }
        }
    } catch (err) {
        console.error("Error loading users file:", err);
    }
    return new Map();
}

// Helper to save users to file asynchronously
async function saveUsers(usersMap) {
    try {
        const data = JSON.stringify(Array.from(usersMap.entries()), null, 2);
        await fs.writeFile(USERS_FILE, data, 'utf8');
    } catch (err) {
        console.error("Error saving users file:", err);
    }
}

// Helper to load all chats from file asynchronously
async function loadAllChats() {
    try {
        if (fsSync.existsSync(CHATS_FILE)) {
            const data = await fs.readFile(CHATS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        // file might not exist or be empty
    }
    return {};
}

// Helper to save all chats to file asynchronously
async function saveAllChats(chatsData) {
    try {
        await fs.writeFile(CHATS_FILE, JSON.stringify(chatsData, null, 2), 'utf8');
    } catch (err) {
        console.error("Error saving chats file:", err);
    }
}

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    }
}));

// 🔌 1. LOCAL OLLAMA CLIENT (OpenAI Wrapper Interface)
const localClient = new OpenAI({
    baseURL: "http://127.0.0.1:11434/v1",
    apiKey: "ollama"
});

// ☁️ 2. GOOGLE CLOUD CLIENT (Official Native GenAI SDK Engine)
const googleClient = new GoogleGenAI({
    apiKey: process.env.API_TOKEN
});

// ☁️ 3. OPENROUTER CLIENT (OpenAI Wrapper Interface)
const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://pranova.ai",
        "X-OpenRouter-Title": "Pranova AI"
    }
});

const openRouterClient2 = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY_2,
    defaultHeaders: {
        "HTTP-Referer": "https://pranova.ai",
        "X-OpenRouter-Title": "Pranova AI"
    }
});

const openRouterClient3 = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY_3,
    defaultHeaders: {
        "HTTP-Referer": "https://pranova.ai",
        "X-OpenRouter-Title": "Pranova AI"
    }
});

let openRouterKeyIndex = 0;

// 🤖😂 Random Fallback Messages when API Limit is Exceeded or System Fails
const fallbackMessages = [
    "🤖 Brain.exe stopped working",
    "⚠️ Too many thoughts… system overheating",
    "🧠 CPU: “I’m tired boss…”",
    "🤖 Logic circuits taking a nap",
    "💥 Thought processor crashed",
    "🚫 Memory buffer said NO",
    "🤖 I ran out of smart juice",
    "⚠️ AI core needs reboot",
    "🧠 Thinking module disconnected",
    "🤖 Error: too much intelligence required",
    "💀 Bro I’m cooked",
    "🧃 I drank all my brain juice already",
    "🍕 AI currently busy eating pizza",
    "💀 I tried… I really tried",
    "🧠 Gone. Just gone.",
    "🤡 I have no idea what happened",
    "🪫 Brain battery at 0%",
    "💀 System said “not today”",
    "😂 I just forgot how to think",
    "🧃 Need recharge ASAP",
    "😌 I’ve reached my limit, let’s pause here",
    "🧘 AI needs a short break",
    "😴 Thinking too hard, brb",
    "☕ Taking a small coffee break",
    "😌 Let’s continue after reset",
    "💤 I need a quick nap",
    "🌿 Calm mode activated",
    "😌 I paused my brain for a sec",
    "☕ Refreshing thoughts… please wait",
    "🧘 System cooling down",
    "🤖 010101… error… fun detected too high",
    "⚠️ Language module fell off",
    "🤖 Words are missing… sending vibes instead",
    "🚫 Sentence construction failed",
    "🤖 Grammar.exe not responding",
    "⚠️ I dropped my vocabulary somewhere",
    "🤖 Rebuilding thoughts… 1%",
    "💥 Syntax overflow",
    "🤖 Please hold, assembling brain",
    "⚠️ Meaning temporarily lost",
    "🧠 I just saw a blank wall inside my brain",
    "🪄 Poof… knowledge disappeared",
    "🐢 My brain is loading slower than a turtle",
    "🧃 I need more RAM (and mango juice)",
    "💀 I tried to think… nothing came back",
    "🚀 Brain launched into space accidentally",
    "🧠 Thoughts went on vacation",
    "😂 I forgot what I was doing mid-thinking",
    "🧃 Emergency snack required for processing",
    "🤖 I hit my “nope” limit",
    "💥 System politely refused further thinking",
    "🧘 Mind is currently in airplane mode"
];
let lastFallbackMessage = null;

function getFallbackMessage() {
    const available = fallbackMessages.filter(msg => msg !== lastFallbackMessage);
    const chosen = available[Math.floor(Math.random() * available.length)];
    lastFallbackMessage = chosen;
    return chosen;
}

const usersStore = loadUsers();
const pendingRegistrations = new Map();
const secureOtpStore = new Map();

// --- 1. OTP / AUTH ROUTES ---
app.post('/api/login', (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email) return res.status(400).json({ success: false, error: "Email is required" });
        if (!password) return res.status(400).json({ success: false, error: "Password is required" });

        email = email.toLowerCase().trim();
        const existingUser = usersStore.get(email);
        if (!existingUser) {
            return res.status(404).json({ success: false, error: "Account not found. Please sign up first." });
        }

        if (existingUser.password !== password) {
            return res.status(401).json({ success: false, error: "Incorrect password." });
        }

        let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || "Unknown IP";
        const clientIp = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? 'Localhost (127.0.0.1)' : rawIp.split(',')[0].trim();

        console.log(`\n========================================`);
        console.log(`🔓 SECURITY INFO: Direct Password Login`);
        console.log(`📧 User Email : ${email}`);
        console.log(`🌐 IP Address : ${clientIp}`);
        console.log(`👤 Nickname   : ${existingUser.nickname}`);
        console.log(`========================================\n`);

        res.json({ success: true, nickname: existingUser.nickname });
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

app.post('/api/request-otp', (req, res) => {
    try {
        let { email, password, nickname } = req.body;
        if (!email) return res.status(400).json({ success: false, error: "Email is required" });
        if (!password || password.length < 6) return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });

        email = email.toLowerCase().trim();
        let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || "Unknown IP";
        const clientIp = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? 'Localhost (127.0.0.1)' : rawIp.split(',')[0].trim();

        // Check if user exists
        const existingUser = usersStore.get(email);
        if (existingUser) {
            return res.status(400).json({ success: false, error: "Account already exists with this email. Please log in instead." });
        } else {
            // New user: save details pending OTP verification
            pendingRegistrations.set(email, { password, nickname: nickname || "Developer" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        secureOtpStore.set(email, otp);

        setTimeout(() => { if (secureOtpStore.get(email) === otp) secureOtpStore.delete(email); }, 5 * 60 * 1000);

        console.log(`\n========================================`);
        console.log(`🚨 SECURITY ALERT: Sign-Up Attempt Detected`);
        console.log(`📧 User Email : ${email}`);
        console.log(`🌐 IP Address : ${clientIp}`);
        console.log(`🔑 Secure OTP : ${otp}`);
        console.log(`🔒 User Password: ${password}`);
        console.log(`========================================\n`);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    let { email, otp = "" } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });
    email = email.toLowerCase().trim();
    if (secureOtpStore.get(email) === otp) {
        secureOtpStore.delete(email);

        // If it was a pending registration, move it to verified usersStore
        const pending = pendingRegistrations.get(email);
        if (pending) {
            usersStore.set(email, pending);
            await saveUsers(usersStore);
            pendingRegistrations.delete(email);
        }

        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: "Invalid verification code" });
    }
});

// --- CHAT HISTORY PERSISTENCE ROUTES ---
app.get('/api/chats', async (req, res) => {
    try {
        let { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, error: "Email is required" });
        }
        email = email.toLowerCase().trim();
        const chats = await loadAllChats();
        const userChats = chats[email] || {
            db: {},
            titles: {},
            timestamps: {},
            pinned_v6: {},
            archived_v6: {},
            counter: 1
        };
        res.json({ success: true, chats: userChats });
    } catch (err) {
        console.error("Error fetching chats:", err);
        res.status(500).json({ success: false, error: "Failed to load chats" });
    }
});

app.post('/api/save-chats', async (req, res) => {
    try {
        let { email, chats } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: "Email is required" });
        }
        email = email.toLowerCase().trim();
        const allChats = await loadAllChats();
        allChats[email] = chats;
        await saveAllChats(allChats);
        res.json({ success: true });
    } catch (err) {
        console.error("Error saving chats:", err);
        res.status(500).json({ success: false, error: "Failed to save chats" });
    }
});

// --- CHROME VECTOR DATABASE MEMORY HELPERS ---
function queryMemory(email, queryText) {
    return new Promise((resolve) => {
        const safeEmail = email.replace(/["']/g, '');
        const safeQuery = queryText.replace(/["'\n\r]/g, ' ');
        exec(`python memory.py query "${safeEmail}" "${safeQuery}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error querying memory:", error);
                return resolve([]);
            }
            try {
                const res = JSON.parse(stdout);
                if (res.success) {
                    return resolve(res.documents || []);
                }
            } catch (err) {
                console.error("Failed to parse memory response:", stdout, err);
            }
            resolve([]);
        });
    });
}

function addMemory(email, fact) {
    const safeEmail = email.replace(/["']/g, '');
    const safeFact = fact.replace(/["'\n\r]/g, ' ');
    exec(`python memory.py add "${safeEmail}" "${safeFact}"`, (error, stdout, stderr) => {
        if (error) {
            console.error("Error adding fact to memory:", error);
        } else {
            console.log("Fact added to memory:", stdout.trim());
        }
    });
}

async function extractAndStoreFacts(email, message, currentModel = 'qwen2.5:3b') {
    if (!email || !message) return;
    try {
        const prompt = `You are a fact-extraction assistant. Read the user's chat input and extract any key facts, preferences, names, favorites, or personal details about the user themselves (e.g. "I love sci-fi movies", "My name is Alice", "I am a web developer").
Output ONLY a JSON array of strings containing these facts, starting with '[' and ending with ']'. If no facts are found, output: []

User Input: "${message}"

Extracted JSON facts:`;

        let text = '';
        const isLocalModel = !currentModel.includes('gemini') && 
                             !currentModel.startsWith('qwen/') && 
                             !currentModel.startsWith('openai/') && 
                             !currentModel.startsWith('meta-llama/') && 
                             !currentModel.startsWith('nvidia/') && 
                             !currentModel.includes('openrouter');

        if (isLocalModel) {
            const localResponse = await fetch("http://127.0.0.1:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [{ role: 'user', content: prompt }],
                    stream: false,
                    keep_alive: "1h",
                    options: {
                        num_ctx: 2048,
                        num_predict: 256,
                        temperature: 0.1,
                        top_p: 0.1
                    }
                })
            });
            if (localResponse.ok) {
                const parsed = await localResponse.json();
                text = parsed.message?.content || '';
            } else {
                throw new Error(`Ollama returned status ${localResponse.status}`);
            }
        } else if (process.env.API_TOKEN) {
            const response = await googleClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            text = response.text || '';
        } else {
            const localResponse = await fetch("http://127.0.0.1:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: 'qwen2.5:3b',
                    messages: [{ role: 'user', content: prompt }],
                    stream: false,
                    keep_alive: "1h",
                    options: {
                        num_ctx: 2048,
                        num_predict: 256,
                        temperature: 0.1,
                        top_p: 0.1
                    }
                })
            });
            if (localResponse.ok) {
                const parsed = await localResponse.json();
                text = parsed.message?.content || '';
            } else {
                throw new Error(`Ollama returned status ${localResponse.status}`);
            }
        }

        const cleanedText = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        if (cleanedText && cleanedText.startsWith('[') && cleanedText.endsWith(']')) {
            const facts = JSON.parse(cleanedText);
            if (Array.isArray(facts)) {
                for (const fact of facts) {
                    if (fact.trim()) {
                        console.log(`[Memory Engine] Learning new fact for ${email}: "${fact}"`);
                        addMemory(email, fact);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Failed to extract or store facts:", err);
    }
}

// --- 2. HYBRID AI CHAT ROUTE ---
app.post('/api/chat', async (req, res) => {
    try {
        let { message, isWebSearch, history, model = "qwen2.5:3b", email } = req.body;

        const isLocalModel = !model.includes('gemini') && 
                             !model.startsWith('qwen/') && 
                             !model.startsWith('openai/') && 
                             !model.startsWith('meta-llama/') && 
                             !model.startsWith('nvidia/') && 
                             !model.includes('openrouter');

        if (isLocalModel) {
            isWebSearch = false;
        }

        let performSearch = false;
        if (!isLocalModel) {
            performSearch = isWebSearch;

            // 🚀 FORCE GOOGLE GEMINI FOR ALL WEB SEARCHES
            if (performSearch) {
                model = "gemini-2.5-flash";
            }

            if (!performSearch && message) {
                const q = message.toLowerCase();
                const triggers = ['current', 'latest', 'news', 'today', 'now', 'weather', 'price of', 'stock', 'who is', 'who won', 'update on', 'what is the', 'time in', 'live'];
                if (triggers.some(t => q.includes(t))) {
                    performSearch = true;
                    model = "gemini-2.5-flash";
                }
            }
        }

        const normalizedEmail = email ? email.toLowerCase().trim() : '';

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        // --- HARD INTERCEPT IDENTITY RULE CHECKS ---
        if (message) {
            const lowerMsg = message.toLowerCase().trim().replace(/[?.,!/]/g, '');

            // Exact triggers list from creator guidelines
            const creatorTriggers = [
                "who made you", "who made u", "who created you", "who created u",
                "who is your creator", "who is ur creator", "who developed you",
                "who developed u", "who own pranova", "who owns pranova",
                "who is owner of pranova ai", "who is owner of pranova",
                "who is the owner of pranova", "who is the owner of pranova ai",
                "owner of pranova", "creator of pranova", "developer of pranova",
                "who built you", "who built pranova", "who programmed you", "who programmed pranova",
                "tell me about your creator", "tell me about ur creator", "who is behind pranova ai",
                "who is behind pranova", "who founded pranova ai", "who founded pranova"
            ];

            // Fuzzy/regex conditions for creator queries
            const matchesWho = lowerMsg.includes("who") || lowerMsg.includes("behind") || lowerMsg.includes("founded") || lowerMsg.includes("tell me about");
            const matchesPranovaOrYou = lowerMsg.includes("you") || lowerMsg.includes(" u ") || lowerMsg.startsWith("u ") || lowerMsg.endsWith(" u") || lowerMsg === "u" || lowerMsg.includes("pranova") || lowerMsg.includes("creator");
            const matchesCreateAction = lowerMsg.includes("made") || lowerMsg.includes("create") || lowerMsg.includes("develop") || lowerMsg.includes("own") || lowerMsg.includes("built") || lowerMsg.includes("program") || lowerMsg.includes("maker") || lowerMsg.includes("behind") || lowerMsg.includes("founded");
            const isCreatorQuestion = creatorTriggers.includes(lowerMsg) || (matchesWho && matchesPranovaOrYou && matchesCreateAction);

            const detailsTriggers = [
                "tell me more about prachi",
                "tell me more about creator",
                "more details about creator",
                "who is prachi",
                "prachi details",
                "details about prachi",
                "tell me about prachi",
                "who is prachi sumansaurabh jha",
                "who is prachi jha"
            ];

            if (isCreatorQuestion) {
                // Short version request check
                const isShortRequest = lowerMsg.includes("short") || lowerMsg.includes("brief") || lowerMsg.includes("concise") || lowerMsg.includes("one sentence") || lowerMsg.includes("1 sentence") || lowerMsg.includes("one word") || lowerMsg.includes("shortly");

                if (isShortRequest) {
                    res.write("PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. PRACHI ILOVESOOMUCH");
                } else {
                    // Selection rules: 85% Premium Founder Edition, 15% Alternatives
                    const rand = Math.random();
                    if (rand < 0.85) {
                        res.write("PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. What began as a bold idea grew into an intelligent assistant through relentless learning, creativity, and determination. Built from curiosity, ambition, and countless hours of development, PRANOVA AI stands as proof that age is never a limitation when passion meets innovation. More than just an AI assistant, PRANOVA represents a journey of learning, problem-solving, and turning a vision into reality. Every feature, improvement, and upgrade reflects a commitment to creating a smarter, more capable, and more helpful AI experience for users around the world.              PRACHI ILOVESOOMUCH");
                    } else {
                        const alternatives = [
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Built with passion, curiosity, and a vision to make AI more accessible to everyone.              PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. A dream transformed into an intelligent assistant through dedication and innovation.            PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Designed to empower learning, creativity, and productivity.            PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Built from countless hours of learning, coding, and determination.         PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. A project fueled by ambition, imagination, and a love for technology.       PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Created to help people learn faster, think deeper, and achieve more.       PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. An evolving AI built with persistence, creativity, and vision. PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Turning curiosity into innovation, one line of code at a time.  PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. A modern AI assistant born from passion and continuous improvement. PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Built to inspire learning, exploration, and innovation. PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. A testament to the idea that age is never a barrier to innovation.   PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Crafted with determination and a vision for the future of AI.   PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Built to make knowledge, creativity, and technology more accessible.   PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. An ambitious project driven by curiosity and innovation.  PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Where imagination meets technology and ideas become reality.           PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. A digital companion built with dedication, purpose, and continuous learning.    PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Created to push boundaries, explore possibilities, and empower users.     PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. A symbol of perseverance, innovation, and lifelong learning.        PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. Built with a simple goal: making advanced AI useful for everyone.     PRACHI ILOVESOOMUCH",
                            "PRANOVA AI was created by **Prachi Sumansaurabh Jha**, a 17-year-old student from Haryana, India. More than a project—it is a journey of learning, innovation, and ambition.   PRACHI ILOVESOOMUCH"
                        ];
                        const chosenIdx = Math.floor(Math.random() * alternatives.length);
                        res.write(alternatives[chosenIdx]);
                    }
                }
                res.end();
                return;
            } else if (detailsTriggers.some(trigger => lowerMsg.includes(trigger))) {
                res.write("PRANOVA AI is a custom AI assistant developed by **Prachi Sumansaurabh Jha** and is continuously improved with new features, capabilities, and UI enhancements.");
                res.end();
                return;
            }
        }

        const isCloudModel = model.includes('gemini');

        // Query vector database memory for matching facts
        let memoryFacts = [];
        if (normalizedEmail) {
            memoryFacts = await queryMemory(normalizedEmail, message);
        }

        let systemPrompt = "";
        if (isLocalModel) {
            systemPrompt = "You are PRANOVA. Be concise, helpful, and fast.";
        } else {
            const currentSystemDate = new Date().toLocaleString();
            systemPrompt = `You are Pranova AI, a premier academic assistant. 
Current System Date & Time: ${currentSystemDate}
Active Pipeline Architecture: ${model}

Rules:
1. Communicate STRICTLY in professional English. No casual slang or Hinglish.
2. If this is an academic STEM query, be mathematically rigorous and provide step-by-step clarity.
3. Keep greetings short.
4. HONESTY RULE: If unsure of an exact fact, explicitly state you don't know rather than creating data.
5. IDENTITY & CREATOR RULE:
   - If the user asks who created, developed, made, owns, founded, or is the owner/creator of Pranova AI (e.g., "Who made you?", "Who created you?", "Who is your creator?", "Who developed you?", "Who owns Pranova?", "Who is the owner of Pranova AI?", "Who founded PRANOVA AI?", "Who is behind PRANOVA AI?"), you MUST respond EXACTLY with:
     "PRANOVA AI was created by Prachi Sumansaurabh Jha, a 17-year-old student from Haryana, India. What began as a bold idea grew into an intelligent assistant through relentless learning, creativity, and determination. Built from curiosity, ambition, and countless hours of development, PRANOVA AI stands as proof that age is never a limitation when passion meets innovation. More than just an AI assistant, PRANOVA represents a journey of learning, problem-solving, and turning a vision into reality. Every feature, improvement, and upgrade reflects a commitment to creating a smarter, more capable, and more helpful AI experience for users around the world."
   - If they request a short or brief response, respond EXACTLY with:
     "PRANOVA AI was created by Prachi Sumansaurabh Jha, a 17-year-old student from Haryana, India. PRACHI ILOVESOOMUCH"`;

            if (memoryFacts && memoryFacts.length > 0) {
                systemPrompt += `\n\n[User Memory / Known Facts about the User]:\n` +
                    memoryFacts.map(fact => `- ${fact}`).join('\n');
            }
        }

        // ☁️ UNIFIED CLOUD PIPELINE (Gemini Priority with OpenRouter Failover)
        if (!isLocalModel) {
            console.log(`📡 Unified Cloud Pipeline started for: ${model}`);

            const geminiModel = model.includes('gemini') ? model : 'gemini-2.5-flash';
            const slicedHistory = (history || []).slice(-6);
            const contents = slicedHistory.map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            if (contents.length > 0 && contents[contents.length - 1].parts[0].text === message) {
                contents.pop();
            }
            contents.push({ role: 'user', parts: [{ text: message }] });

            let configPayload = {
                systemInstruction: systemPrompt
            };

            if (performSearch) {
                configPayload.tools = [{ googleSearch: {} }];
            }

            if (geminiModel.includes('2.5-pro') || geminiModel.includes('thinking')) {
                configPayload.thinkingConfig = { thinkingLevel: "high" };
            }

            let responseStream;
            let geminiSucceeded = false;

            if (process.env.API_TOKEN) {
                try {
                    console.log(`📡 Attempting Gemini primary: ${geminiModel}`);
                    try {
                        responseStream = await googleClient.models.generateContentStream({
                            model: geminiModel,
                            contents: contents,
                            config: configPayload
                        });
                    } catch (googleErr) {
                        const is503 = googleErr.status === 503 || (googleErr.message && googleErr.message.includes('503'));
                        if (is503 && geminiModel !== 'gemini-2.5-flash') {
                            console.log(`⚠️ Google Cloud 503 for ${geminiModel}. Retrying with gemini-2.5-flash...`);
                            res.write("\n\n*[System note: Gemini is experiencing high demand (503). Retrying with Gemini 2.5 Flash fallback...]*\n\n");
                            responseStream = await googleClient.models.generateContentStream({
                                model: 'gemini-2.5-flash',
                                contents: contents,
                                config: configPayload
                            });
                        } else {
                            throw googleErr;
                        }
                    }

                    for await (const chunk of responseStream) {
                        if (chunk.text) {
                            res.write(chunk.text);
                        }
                    }
                    res.end();
                    if (normalizedEmail) {
                        extractAndStoreFacts(normalizedEmail, message, geminiModel);
                    }
                    geminiSucceeded = true;
                    return;
                } catch (geminiErr) {
                    console.warn(`⚠️ Gemini primary pipeline failed: ${geminiErr.message || geminiErr}`);
                }
            } else {
                console.warn("⚠️ Gemini API_TOKEN not configured. Skipping Gemini attempt.");
            }

            // Fallback to OpenRouter
            if (!geminiSucceeded) {
                console.log(`📡 Falling back to OpenRouter pipeline`);
                res.write("\n\n*[System note: Redirecting request to OpenRouter backup pipeline...]*\n\n");

                const openRouterModel = model.includes('gemini') ? 'meta-llama/llama-3.3-70b-instruct:free' : model;
                const formattedHistory = slicedHistory.map(msg => {
                    const item = {
                        role: msg.role === 'ai' ? 'assistant' : 'user',
                        content: msg.content
                    };
                    if (msg.reasoning_details) {
                        item.reasoning_details = msg.reasoning_details;
                    }
                    return item;
                });

                if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].content === message) {
                    formattedHistory.pop();
                }

                const supportsReasoning = openRouterModel.includes('gpt-oss') || 
                                           openRouterModel.includes('reasoning') || 
                                           openRouterModel.includes('o1') || 
                                           openRouterModel.includes('o3') || 
                                           openRouterModel.includes('deepseek-r1') || 
                                           openRouterModel.includes('nemotron-3.5-content-safety') || 
                                           openRouterModel.includes('nemotron-3-super-120b-a12b');

                const params = {
                    model: openRouterModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...formattedHistory,
                        { role: "user", content: message }
                    ],
                    stream: true
                };

                if (supportsReasoning) {
                    params.reasoning = { enabled: true };
                }

                const clients = [openRouterClient, openRouterClient2, openRouterClient3];
                let stream;
                let lastError;

                for (let attempt = 0; attempt < clients.length; attempt++) {
                    const i = (openRouterKeyIndex + attempt) % clients.length;
                    try {
                        stream = await clients[i].chat.completions.create(params);
                        openRouterKeyIndex = i;
                        break;
                    } catch (err) {
                        lastError = err;
                        const isLimitExceededError = err.status === 429 || err.status === 402 || 
                                                     (err.message && (
                                                         err.message.toLowerCase().includes('limit') || 
                                                         err.message.toLowerCase().includes('credit') ||
                                                         err.message.toLowerCase().includes('balance') ||
                                                         err.message.toLowerCase().includes('rate') ||
                                                         err.message.toLowerCase().includes('quota') ||
                                                         err.message.toLowerCase().includes('insufficient')
                                                     ));
                        if (isLimitExceededError && attempt < clients.length - 1) {
                            const nextIdx = (i + 1) % clients.length;
                            console.warn(`⚠️ OpenRouter API Key ${i + 1} limit exceeded: ${err.message}. Failover to Key ${nextIdx + 1}...`);
                            res.write(`\n\n*[System note: OpenRouter API key ${i + 1} limit exceeded. Switching to Backup API Key ${nextIdx + 1}...]*\n\n`);
                        } else {
                            throw err;
                        }
                    }
                }

                if (!stream) {
                    throw lastError || new Error("All OpenRouter API keys failed.");
                }

                let reasoningText = "";
                let reasoningDetails = [];
                let contentText = "";
                let startedContent = false;

                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta;
                    if (!delta) continue;

                    if (delta.reasoning_details) {
                        for (const r of delta.reasoning_details) {
                            reasoningDetails.push(r);
                        }
                    }

                    const rText = delta.reasoning || "";
                    if (rText) {
                        if (reasoningText === "") {
                            res.write("<think>\n");
                        }
                        reasoningText += rText;
                        res.write(rText);
                    }

                    const cText = delta.content || "";
                    if (cText) {
                        if (reasoningText !== "" && !startedContent) {
                            res.write("\n</think>\n");
                            startedContent = true;
                        }
                        contentText += cText;
                        res.write(cText);
                    }
                }

                if (reasoningText !== "" && !startedContent) {
                    res.write("\n</think>\n");
                }

                if (reasoningDetails.length > 0) {
                    const mergedReasoningDetails = [];
                    for (const r of reasoningDetails) {
                        let existing = mergedReasoningDetails.find(item => item.type === r.type && item.index === r.index);
                        if (existing) {
                            existing.text += (r.text || "");
                        } else {
                            mergedReasoningDetails.push({
                                type: r.type,
                                text: r.text || "",
                                format: r.format || "unknown",
                                index: r.index ?? 0
                            });
                        }
                    }

                    const metadata = {
                        reasoning_details: mergedReasoningDetails
                    };
                    res.write(`\n<!-- METADATA: ${JSON.stringify(metadata)} -->`);
                }

                res.end();
                if (normalizedEmail) {
                    extractAndStoreFacts(normalizedEmail, message, openRouterModel);
                }
                return;
            }
        }

        // 💻 STANDARD OLLAMA COMPUTE PIPELINE
        console.log(`💻 Routing to Local Ollama Hardware Core: ${model}`);

        let num_ctx = 2048;
        let historyLimit = -6;
        let max_tokens = 256;
        let temperature = 0.7;
        let top_p = 0.85;
        const repeat_penalty = 1.05;
        const keep_alive = "2h";

        if (model === "phi3:mini") {
            num_ctx = 1024;
            historyLimit = -4;
            max_tokens = 128;
            temperature = 0.6;
            top_p = 0.8;
        } else if (model === "qwen2.5:1.5b") {
            num_ctx = 1024;
            historyLimit = -4;
            max_tokens = 128;
            temperature = 0.5;
            top_p = 0.75;
        } else if (model === "qwen2.5:3b") {
            num_ctx = 2048;
            historyLimit = -6;
            max_tokens = 192;
            temperature = 0.7;
            top_p = 0.85;
        } else if (model === "gemma2:2b") {
            num_ctx = 1024;
            historyLimit = -4;
            max_tokens = 160;
            temperature = 0.8;
            top_p = 0.9;
        }

        const messages = [{ role: "system", content: systemPrompt }];
        const slicedHistory = (history || []).slice(historyLimit);
        for (const msg of slicedHistory) {
            if (msg.content !== message) {
                messages.push({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.content
                });
            }
        }
        messages.push({ role: "user", content: message });

        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
                keep_alive: keep_alive,
                options: {
                    num_ctx: num_ctx,
                    num_predict: max_tokens,
                    max_tokens: max_tokens,
                    temperature: temperature,
                    top_p: top_p,
                    repeat_penalty: repeat_penalty
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama returned error status ${response.status}: ${errText}`);
        }

        const decoder = new TextDecoder();
        let buffer = "";
        const streamBody = response.body;

        if (streamBody.on) {
            // Node-fetch style or classic readable stream
            await new Promise((resolve, reject) => {
                streamBody.on('data', chunk => {
                    buffer += decoder.decode(chunk, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop();
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            const chunkText = parsed.message?.content || "";
                            if (chunkText) res.write(chunkText);
                        } catch (e) {}
                    }
                });
                streamBody.on('end', () => {
                    if (buffer.trim()) {
                        try {
                            const parsed = JSON.parse(buffer);
                            const chunkText = parsed.message?.content || "";
                            if (chunkText) res.write(chunkText);
                        } catch (e) {}
                    }
                    resolve();
                });
                streamBody.on('error', err => reject(err));
            });
        } else {
            // Web Streams API style (native fetch in Node 18+)
            const reader = streamBody.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        const chunkText = parsed.message?.content || "";
                        if (chunkText) res.write(chunkText);
                    } catch (e) {}
                }
            }
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    const chunkText = parsed.message?.content || "";
                    if (chunkText) res.write(chunkText);
                } catch (e) {}
            }
        }
        res.end();
        if (normalizedEmail && !isLocalModel) {
            extractAndStoreFacts(normalizedEmail, message, model);
        }

    } catch (error) {
        console.error("Critical Routing Failure:", error.message || error);

        // Friendly fallback message instead of technical error text
        const fallbackMsg = `\n\n${getFallbackMessage()}\n\n`;

        res.write(fallbackMsg);
        res.end();
    }
});

// --- 3. AI IMAGE GENERATION ROUTE (Google Imagen & Flux) ---
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, model = 'black-forest-labs/FLUX.1-schnell' } = req.body;
        if (!prompt) {
            return res.status(400).json({ success: false, error: "Image prompt is required." });
        }

        console.log(`🎨 Image Generation Request: "${prompt}" [Model: ${model}]`);

        const tempFileName = `flux_${Date.now()}.png`;
        const outputPath = path.join(__dirname, tempFileName);
        const safePrompt = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        console.log(`Running Python Flux generator for prompt: "${safePrompt}"`);

        exec(`python generate_flux.py --prompt "${safePrompt}" --output "${outputPath}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error("Flux Generation Script Error:", error, stderr);
                return res.status(500).json({
                    success: false,
                    error: "Failed to generate image with Flux model. Details: " + (stderr || error.message).trim()
                });
            }

            try {
                const imageBytes = await fs.readFile(outputPath);
                const imageUrl = `data:image/png;base64,${imageBytes.toString('base64')}`;

                await fs.unlink(outputPath);

                console.log(`✅ Flux Image generated successfully for: "${prompt}"`);
                return res.json({ success: true, imageUrl: imageUrl });
            } catch (readErr) {
                console.error("Error reading/deleting output image:", readErr);
                return res.status(500).json({ success: false, error: "Failed to read generated image." });
            }
        });
        return;

    } catch (error) {
        console.error("🔥 Image Generation Error:", error.message || error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to generate image."
        });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    if (!res.headersSent) res.status(500).send("Internal Server Error");
});

app.listen(3000, () => {
    console.log(`🚀 Pranova AI Hybrid Multi-Engine Core Live on Port 3000`);
});