const fs = require('fs');
const content = fs.readFileSync('src/components/ClientReceiptsView.tsx', 'utf8');

const tags = [];
const regex = /<\/?([a-zA-Z0-9]+|)[^>]*>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const fullMatch = match[0];
  const isClosing = fullMatch.startsWith('</');
  const isSelfClosing = fullMatch.endsWith('/>');
  
  if (isSelfClosing) continue;

  const tagNameMatch = fullMatch.match(/<\/?([a-zA-Z0-9]+)/);
  const tagName = tagNameMatch ? tagNameMatch[1] : '';

  if (isClosing) {
    if (tags.length === 0) {
      console.log('Extra closing tag:', fullMatch, 'at index', match.index);
    } else {
      const lastOpen = tags.pop();
      if (lastOpen !== tagName) {
        console.log('Mismatch: expected to close', lastOpen, 'but found', fullMatch, 'at line', content.substring(0, match.index).split('\n').length);
        break;
      }
    }
  } else {
    tags.push(tagName);
  }
}
console.log('Unclosed tags remaining:', tags);
