const fs = require('fs');

let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

code = code.replace(
  "import { SmartImage } from './SmartImage';",
  "import { SmartImage } from './SmartImage';\nimport { SharedDriveImagePicker } from './SharedDriveImagePicker';"
);

// Add sharedPickerConfig to FurnitureFormModal
code = code.replace(
  "const [showInspirationSlot, setShowInspirationSlot] = useState(false);",
  "const [showInspirationSlot, setShowInspirationSlot] = useState(false);\n  const [sharedPickerConfig, setSharedPickerConfig] = useState<any>(null);"
);

// Replace openDrivePicker inside handleChooseFromDrive
const handleChooseStart = `
  const handleChooseFromDrive = async (type: string, label?: string) => {
    console.log(\`[Drive Picker] Opening for slot: \${type}\`);
    setDrivePickerError(null);
    const isMiniCharm = isMiniCharmItem(formData);
    const isFigure = (formData.madeFor || '').toLowerCase().trim() === 'figure' || (formData.madeFor || '').toLowerCase().trim() === 'figures';

    let slotFolderId: string;
    let includeFolders = false;
    if (isMiniCharm) {
      try {
        slotFolderId = driveFolders?.miniCharmsFolderId || await getOrCreateMiniCharmsFolder(driveFolders?.printsFolderId);
      } catch (err) {
        slotFolderId = getFolderIdForSlot('mini_charm', driveFolders);
      }
    } else if (isFigure) {
      slotFolderId = driveFolders?.figuresFolderId || getFolderIdForSlot('inspiration', driveFolders);
      includeFolders = true;
    } else {
      slotFolderId = getFolderIdForSlot(type, driveFolders);
    }
`;

const handleChooseBodyOldRegex = /openDrivePicker\(\{[\s\S]*?onPick: \(selectedImages\) => \{[\s\S]*?\}\);/g;

const newHandleChoose = `
    const slotLabel = isMiniCharm ? 'Mini Charm Photo' : (label || (type === 'inspiration' ? 'Reference Photo' : type === 'design' ? '3D Mock-Up' : 'Photo'));
    
    setSharedPickerConfig({
      isOpen: true,
      folderId: slotFolderId,
      title: \`Select \${slotLabel}\`,
      uploadSection: 'minifurniture',
      onSelect: (doc: any) => {
        const newDriveImage: MiniFurnitureImage = {
          id: uuidv4(),
          driveFileId: doc.id,
          driveFolderId: slotFolderId,
          filename: doc.name || 'Drive Image',
          mimeType: doc.mimeType || 'image/jpeg',
          type: isMiniCharm ? 'finished' : type,
          label: slotLabel,
          source: 'google-drive',
          status: 'ready',
          url: doc.url || ''
        };

        setFormData(prev => {
          if (isMiniCharm) {
            return {
              ...prev,
              driveFileId: doc.id,
              driveFolderId: slotFolderId,
              images: [newDriveImage]
            };
          } else {
            const existingIndex = prev.images.findIndex(img => img.type === type && (!isExtraSlot(type) || img.label === label));
            if (existingIndex >= 0) {
              const newImages = [...prev.images];
              newImages[existingIndex] = newDriveImage;
              return { ...prev, images: newImages };
            }
            return { ...prev, images: [...prev.images, newDriveImage] };
          }
        });
        setSharedPickerConfig(null);
      }
    });
`;

let modalCodeMatch = code.match(/const FurnitureFormModal = \([\s\S]*?(?=export const MiniFurnitureView = \(\) => \{)/);
if (modalCodeMatch) {
  let modalCode = modalCodeMatch[0];
  
  modalCode = modalCode.replace(
    /openDrivePicker\(\{\s*slotType:[\s\S]*?onPick: \(selectedImages\) => \{[\s\S]*?\}\s*\}\);\s*\}\);/g,
    "// REPLACED"
  );
  
  // Actually, let's just replace the exact block in handleChooseFromDrive
  const handleChooseBlock = modalCode.match(/const handleChooseFromDrive = async \([\s\S]*?\}\);\s*\};/);
  if (handleChooseBlock) {
    let replacedBlock = handleChooseBlock[0].replace(/openDrivePicker\(\{[\s\S]*?\}\s*\);\s*\};/, newHandleChoose + "\n  };");
    
    // Removing the pre-check folder empty status because SharedDriveImagePicker handles it
    replacedBlock = replacedBlock.replace(/\/\/ Pre-check if folder has images[\s\S]*?openDrivePicker\(\{/, "\n    " + newHandleChoose + "\n// skipped");
    
    // Clean it up properly:
    // Let's just rewrite handleChooseFromDrive completely using string replacement
    const fullNewHandleChoose = handleChooseStart + `
    const slotLabel = isMiniCharm ? 'Mini Charm Photo' : (label || (type === 'inspiration' ? 'Reference Photo' : type === 'design' ? '3D Mock-Up' : 'Photo'));
    
    setSharedPickerConfig({
      isOpen: true,
      folderId: slotFolderId,
      title: \`Select \${slotLabel}\`,
      uploadSection: 'minifurniture',
      onSelect: (doc: any) => {
        const newDriveImage = {
          id: uuidv4(),
          driveFileId: doc.id,
          driveFolderId: slotFolderId,
          filename: doc.name || 'Drive Image',
          mimeType: doc.mimeType || 'image/jpeg',
          type: isMiniCharm ? 'finished' : type,
          label: slotLabel,
          source: 'google-drive',
          status: 'ready',
          url: doc.url || doc.thumbnailLink || ''
        };

        setFormData(prev => {
          if (isMiniCharm) {
            return {
              ...prev,
              driveFileId: doc.id,
              driveFolderId: slotFolderId,
              images: [newDriveImage]
            };
          } else {
            const existingIndex = prev.images.findIndex(img => img.type === type && (!label || img.label === label));
            if (existingIndex >= 0) {
              const newImages = [...prev.images];
              newImages[existingIndex] = newDriveImage;
              return { ...prev, images: newImages };
            }
            return { ...prev, images: [...prev.images, newDriveImage] };
          }
        });
        setSharedPickerConfig(null);
      }
    });
  };
`;
    
    modalCode = modalCode.replace(/const handleChooseFromDrive = async \([\s\S]*?\}\);\s*\};/, fullNewHandleChoose);
  }

  // add SharedDriveImagePicker rendering to the end of modalCode
  modalCode = modalCode.replace(
    /\{cropEditingPhoto && \(/,
    `{sharedPickerConfig?.isOpen && (
        <SharedDriveImagePicker
          folderId={sharedPickerConfig.folderId}
          title={sharedPickerConfig.title}
          uploadSection={sharedPickerConfig.uploadSection}
          onClose={() => setSharedPickerConfig(null)}
          onSelect={sharedPickerConfig.onSelect}
        />
      )}
      {cropEditingPhoto && (`
  );

  code = code.replace(modalCodeMatch[0], modalCode);
}

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
