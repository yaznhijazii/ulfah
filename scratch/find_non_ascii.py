import sys

with open(r'c:\Users\yazan.hijazi\Ulfah\src\app\components\HomeScreen.tsx', 'rb') as f:
    content = f.read()

for i, byte in enumerate(content):
    if byte > 127:
        # Found non-ASCII character
        # Find which line it is on
        line_num = content[:i].count(b'\n') + 1
        pos_in_line = i - content[:i].rfind(b'\n')
        print(f"Non-ASCII at {line_num}:{pos_in_line}: byte {byte} ({hex(byte)})")
