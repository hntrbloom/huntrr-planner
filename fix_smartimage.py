import re

with open('src/components/SmartImage.tsx', 'r') as f:
    content = f.read()

# I will just use regex to find `...props }) => {`
content = re.sub(
    r"\.\.\.props\s*\}\) => \{",
    "mimeType, filename, ...props }) => {",
    content
)

with open('src/components/SmartImage.tsx', 'w') as f:
    f.write(content)
