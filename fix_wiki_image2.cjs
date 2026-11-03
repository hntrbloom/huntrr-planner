const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

const oldDetailImg = `<WikiImage url={character.imageUrl} storagePath={character.imageStoragePath} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />`;
const newDetailImg = `{character.driveFileId ? (
              <SmartImage src={character.imageUrl} driveFileId={character.driveFileId} fallbackDriveFileId={character.driveFileId} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />
            ) : (
              <WikiImage url={character.imageUrl} storagePath={character.imageStoragePath} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />
            )}`;

code = code.replace(oldDetailImg, newDetailImg);
fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
