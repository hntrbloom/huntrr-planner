const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

// In CharacterDetail:
const errViewer = `        <ImageViewerModal
          image={{
            url: character.imageUrl,
            storagePath: character.imageStoragePath,
            title: \`\${character.name} Main Photo\`,
            filename: \`\${character.name}_main_photo\`
          }}`;

const fixViewer = `        <ImageViewerModal
          image={{
            url: character.imageUrl,
            storagePath: character.imageStoragePath,
            driveFileId: character.driveFileId,
            title: \`\${character.name} Main Photo\`,
            filename: \`\${character.name}_main_photo\`
          }}`;

code = code.replace(errViewer, fixViewer);

// In CharacterDetail's allImages mapping:
const errAll = `allImages={character.myDesigns?.map((d: any, i: number) => ({
                  url: d.url || d,
                  storagePath: d.storagePath,
                  title: \`\${character.name} Character Photo\`
                })).concat([{ url: character.imageUrl, storagePath: character.imageStoragePath, title: \`\${character.name} Main Photo\` }])}`;

const fixAll = `allImages={character.myDesigns?.map((d: any, i: number) => ({
                  url: d.url || d,
                  storagePath: d.storagePath,
                  title: \`\${character.name} Character Photo\`
                })).concat([{ url: character.imageUrl, storagePath: character.imageStoragePath, driveFileId: character.driveFileId, title: \`\${character.name} Main Photo\` }])}`;
                
code = code.replace(errAll, fixAll);

fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
