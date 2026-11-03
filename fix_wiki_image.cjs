const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

// 1. Update Character Interface to include driveFileId
code = code.replace(
  '  imageStoragePath?: string;\n}',
  '  imageStoragePath?: string;\n  driveFileId?: string;\n}'
);

// 2. We should use SmartImage instead of WikiImage if driveFileId is present!
// Wait, is SmartImage imported? Let's check.
if (!code.includes('SmartImage')) {
  code = code.replace("import { ImageViewerModal", "import { SmartImage } from './SmartImage';\nimport { ImageViewerModal");
}

// 3. Update the picker usage in CharacterForm to set driveFileId
const pickerCode = `        <WikiDriveImagePicker
          onClose={() => setShowWikiImagePicker(false)}
          onSelect={(img) => {
            setFormData(prev => ({
              ...prev,
              imageUrl: img.url || img.thumbnailLink,
              imageStoragePath: img.id,
              driveFileId: img.id
            }));
            setShowWikiImagePicker(false);
          }}
        />`;
code = code.replace(/<WikiDriveImagePicker[\s\S]*?\/>/, pickerCode);

// 4. Update the preview in CharacterForm to use SmartImage if driveFileId is set
const oldPreview = `<WikiImage url={formData.imageUrl} storagePath={formData.imageStoragePath} alt="Preview" className="w-full h-full object-contain" />`;
const newPreview = `{formData.driveFileId ? (
                    <SmartImage src={formData.imageUrl} driveFileId={formData.driveFileId} fallbackDriveFileId={formData.driveFileId} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <WikiImage url={formData.imageUrl} storagePath={formData.imageStoragePath} alt="Preview" className="w-full h-full object-contain" />
                  )}`;
code = code.replace(oldPreview, newPreview);

// 5. Update the card rendering in CharacterWikiCard
const oldCardImg = `<WikiImage url={char.imageUrl} storagePath={char.imageStoragePath} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />`;
const newCardImg = `{char.driveFileId ? (
            <SmartImage src={char.imageUrl} driveFileId={char.driveFileId} fallbackDriveFileId={char.driveFileId} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <WikiImage url={char.imageUrl} storagePath={char.imageStoragePath} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          )}`;
code = code.replace(oldCardImg, newCardImg);

fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
