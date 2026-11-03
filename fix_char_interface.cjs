const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

const oldInterface = `  imageUrl: string;
  imageStoragePath?: string;
  myDesigns: (string | CharacterImage)[];
}`;

const newInterface = `  imageUrl: string;
  imageStoragePath?: string;
  driveFileId?: string;
  myDesigns: (string | CharacterImage)[];
}`;

code = code.replace(oldInterface, newInterface);
fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
