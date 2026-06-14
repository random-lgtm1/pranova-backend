with open('c:/Users/SUMAN JHA/Desktop/PRONOVA APP/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We need to insert the missing CSS selector before line 1757 (index 1756).
# The missing part is:
#         .msg-edit-textarea {
#             width: 100%;
#             background: rgba(255, 255, 255, 0.03);
#             border: 1px solid rgba(255, 255, 255, 0.1);
#             border-radius: 12px;
#             padding: 14px;
#             color: var(--t1);

missing_css = [
    "        .msg-edit-textarea {\n",
    "            width: 100%;\n",
    "            background: rgba(255, 255, 255, 0.03);\n",
    "            border: 1px solid rgba(255, 255, 255, 0.1);\n",
    "            border-radius: 12px;\n",
    "            padding: 14px;\n",
    "            color: var(--t1);\n"
]

# verify we are at the right spot
if 'font-size: 15.5px;' in lines[1756]:
    for i, line in enumerate(reversed(missing_css)):
        lines.insert(1756, line)
    
    with open('c:/Users/SUMAN JHA/Desktop/PRONOVA APP/index.html', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Repaired dangling CSS successfully!")
else:
    print("Line 1757 does not contain 'font-size: 15.5px;', instead got:", lines[1756].strip())
