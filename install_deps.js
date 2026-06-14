const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("🐍 Starting python dependency installer...");

// Check if we can create a venv
const venvPath = path.join(__dirname, 'venv');
let hasVenv = false;

try {
    if (!fs.existsSync(venvPath)) {
        console.log("Creating virtual environment...");
        try {
            execSync('python3 -m venv venv', { stdio: 'inherit' });
            hasVenv = true;
        } catch (e) {
            try {
                console.log("python3 -m venv failed, trying python -m venv...");
                execSync('python -m venv venv', { stdio: 'inherit' });
                hasVenv = true;
            } catch (e2) {
                try {
                    console.log("python -m venv failed, trying virtualenv...");
                    execSync('virtualenv venv', { stdio: 'inherit' });
                    hasVenv = true;
                } catch (e3) {
                    console.warn("⚠️ All venv creation methods failed. Falling back to global.");
                }
            }
        }
    } else {
        console.log("Virtual environment already exists.");
        hasVenv = true;
    }
} catch (err) {
    console.warn("⚠️ Failed to create virtual environment. Falling back to global/user installation. Error:", err.message);
}

if (hasVenv) {
    try {
        console.log("Installing requirements in virtual environment...");
        const pipPath = process.platform === 'win32' 
            ? path.join(venvPath, 'Scripts', 'pip.exe') 
            : path.join(venvPath, 'bin', 'pip');
        
        execSync(`"${pipPath}" install -r requirements.txt`, { stdio: 'inherit' });
        console.log("✅ Successfully installed requirements inside virtual environment.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to install inside venv. Falling back to global...", err.message);
    }
}

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
