const { execSync } = require('child_process');

const commands = [
    'pip install -r requirements.txt',
    'pip install --break-system-packages -r requirements.txt',
    'pip3 install -r requirements.txt',
    'pip3 install --break-system-packages -r requirements.txt',
    'python -m pip install -r requirements.txt',
    'python3 -m pip install -r requirements.txt',
    'python -m pip install --break-system-packages -r requirements.txt',
    'python3 -m pip install --break-system-packages -r requirements.txt'
];

console.log("🐍 Starting python dependency installer...");

let success = false;
for (const cmd of commands) {
    try {
        console.log(`Executing: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        console.log(`✅ Successfully executed: ${cmd}`);
        success = true;
        break;
    } catch (err) {
        console.warn(`⚠️ Command failed: ${cmd}. Error: ${err.message}`);
    }
}

if (!success) {
    console.error("❌ Failed to install python dependencies. Please install them manually: requests, python-dotenv, chromadb, huggingface_hub");
    process.exit(0); // Do not fail the build, but log the issue
}
