const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');
code = code.replace(/<Trash2 className="w-4 h-4" \/>/g, '<X className="w-4 h-4" />');
// Wait, position: top-2 right-2
code = code.replace(/className="p-1\.5 bg-black\/60/g, 'className="absolute top-2 right-2 p-1.5 bg-black/60');
fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
