const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

// 1. Remove handleConfirmRemovePhoto
code = code.replace(/const handleConfirmRemovePhoto = async \(\) => \{[\s\S]*?setIsRemovingPhoto\(false\);\n\s*\}\n\s*\};\n/g, '');

// 2. Remove the JSX for photoToRemove modal.
// I will just use a simpler regex or replace it directly.
const modalStart = '{photoToRemove && (';
const modalIndex = code.indexOf(modalStart);
if (modalIndex !== -1) {
  // Let's use a simple brace matching to find the end
  let openBraces = 0;
  let endIndex = -1;
  let started = false;
  for (let i = modalIndex; i < code.length; i++) {
    if (code[i] === '{') {
      openBraces++;
      started = true;
    } else if (code[i] === '}') {
      openBraces--;
    }
    if (started && openBraces === 0) {
      endIndex = i;
      break;
    }
  }
  if (endIndex !== -1) {
    code = code.slice(0, modalIndex) + code.slice(endIndex + 1);
  }
}

// 3. Just in case the previous regex failed because of formatting, try another regex
code = code.replace(/\{photoToRemove && \([\s\S]*?\}\)\}/g, '');

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
