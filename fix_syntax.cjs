const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

// Fix 1
const err1 = `{character.imageUrl ? (
            {character.driveFileId ? (
              <SmartImage src={character.imageUrl} driveFileId={character.driveFileId} fallbackDriveFileId={character.driveFileId} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />
            ) : (
              <WikiImage url={character.imageUrl} storagePath={character.imageStoragePath} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />
            )}
          ) : (`;

const fix1 = `{character.imageUrl ? (
            character.driveFileId ? (
              <SmartImage src={character.imageUrl} driveFileId={character.driveFileId} fallbackDriveFileId={character.driveFileId} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />
            ) : (
              <WikiImage url={character.imageUrl} storagePath={character.imageStoragePath} alt={character.name} className="w-full h-full object-contain drop-shadow-md max-h-[400px]" />
            )
          ) : (`;
code = code.replace(err1, fix1);

// Fix 2
const err2 = `{char.imageUrl ? (
          {char.driveFileId ? (
            <SmartImage src={char.imageUrl} driveFileId={char.driveFileId} fallbackDriveFileId={char.driveFileId} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <WikiImage url={char.imageUrl} storagePath={char.imageStoragePath} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          )}
        ) : (`;

const fix2 = `{char.imageUrl ? (
          char.driveFileId ? (
            <SmartImage src={char.imageUrl} driveFileId={char.driveFileId} fallbackDriveFileId={char.driveFileId} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <WikiImage url={char.imageUrl} storagePath={char.imageStoragePath} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          )
        ) : (`;
code = code.replace(err2, fix2);

fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
