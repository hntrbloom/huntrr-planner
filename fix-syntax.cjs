const fs = require('fs');
const code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8').split('\n');

// Find the line with onError: (msg)
const onErrorIdx = code.findIndex(line => line.includes('onError: (msg) => {'));
if (onErrorIdx !== -1) {
  // delete from onErrorIdx - 1 (the }, line) to onErrorIdx + 8 (the }); line)
  code.splice(onErrorIdx - 1, 10);
}

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code.join('\n'));
