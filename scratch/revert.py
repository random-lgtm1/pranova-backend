import re

with open('c:/Users/SUMAN JHA/Desktop/PRONOVA APP/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove CSS
css_start = r'        /\* Master Layout \*/\s*\.model-split-layout \{'
css_end = r'\s*\.status-dot\.running-dot \{\s*background: #4ade80;\s*box-shadow: 0 0 8px rgba\(74, 222, 128, 0\.6\);\s*\}'
text = re.sub(css_start + r'.*?' + css_end, '', text, flags=re.DOTALL)

# 2. Remove HTML
html_start = r'\s*<div class="model-dropdown-menu" id="modelDropdownMenu">'
html_end = r'<div class="model-menu-footer">\s*<span id="modelsStats">Local: 5 • Cloud: 3 • OpenRouter: 4</span>\s*<span>Total: <span id="totalModelsCount">12</span></span>\s*</div>\s*</div>'
text = re.sub(html_start + r'.*?' + html_end, '', text, flags=re.DOTALL)

# 3. Remove JS
js_start = r'\s*// Add state to track active provider tab globally\s*let currentActiveProvider = \'local\';'
js_end = r'modelsStats\.innerText = `Local: \$\{grouped\.local\.length\} • Cloud: \$\{grouped\.google\.length\} • OpenRouter: \$\{grouped\.openrouter\.length\}`;.*?\}\s*\}'
text = re.sub(js_start + r'.*?' + js_end, '', text, flags=re.DOTALL)

with open('c:/Users/SUMAN JHA/Desktop/PRONOVA APP/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Removed all injected code.")
