const fs = require('fs');

let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

code = code.replace(
  "import { WikiDriveImagePicker } from './WikiDriveImagePicker';",
  "import { SharedDriveImagePicker } from './SharedDriveImagePicker';\nimport { searchOrResolveHuntrrSpaceFolders } from '../lib/driveFolderUtils';"
);

const newPicker = `
      {showWikiImagePicker && (
        <WikiFolderResolver 
          onResolved={(folderId) => {
            if (!folderId) {
              alert('Could not resolve Wiki folder.');
              setShowWikiImagePicker(false);
              return;
            }
            setShowWikiImagePicker(folderId);
          }}
        />
      )}
      {typeof showWikiImagePicker === 'string' && (
        <SharedDriveImagePicker
          folderId={showWikiImagePicker}
          title="Select Wiki Photo"
          uploadSection="wiki"
          onClose={() => setShowWikiImagePicker(false)}
          onSelect={(img) => {
            setFormData(prev => ({
              ...prev,
              driveFileId: img.id,
              imageUrl: img.url || img.thumbnailLink || \`https://drive.google.com/thumbnail?id=\${img.id}\`,
              imageStoragePath: undefined
            }));
            setShowWikiImagePicker(false);
          }}
        />
      )}
`;

code = code.replace(
  /\{\s*showWikiImagePicker && \(\s*<WikiDriveImagePicker[\s\S]*?onSelect=\{\(img\) => \{[\s\S]*?setShowWikiImagePicker\(false\);\s*\}\}\s*\/>\s*\)\}/,
  newPicker
);

const resolver = `
function WikiFolderResolver({ onResolved }: { onResolved: (id: string | null) => void }) {
  React.useEffect(() => {
    searchOrResolveHuntrrSpaceFolders().then(folders => {
      onResolved(folders.wikiFolderId || null);
    }).catch(err => {
      console.error(err);
      onResolved(null);
    });
  }, []);
  return null;
}
`;

code = code + '\n' + resolver;

fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
