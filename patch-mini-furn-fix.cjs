const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

let block1Match = code.match(/openDrivePicker\(\{\s*slotType:\s*'inspiration',\s*printsFolderId:\s*folders\.figuresFolderId,[\s\S]*?\}\);\s*\} catch/);
if (block1Match) {
  code = code.replace(block1Match[0], `setSharedPickerConfig({
          isOpen: true,
          folderId: folders.figuresFolderId,
          title: 'Select Figure Inspiration',
          uploadSection: 'minifurniture',
          onSelect: (doc: any) => {
             setIsTypeSelectorOpen(false);
             setIsFormOpen(true);
             
             if (!doc) {
               if (draftFormData) {
                 setDraftFormData({ ...draftFormData, madeFor: optType });
               } else {
                 setSelectedInitialType(optType);
               }
               return;
             }
             
             const newImg = {
                id: uuidv4(),
                driveFileId: doc.id,
                driveFolderId: folders.figuresFolderId,
                filename: doc.name || 'Drive Image',
                mimeType: doc.mimeType || 'image/jpeg',
                type: 'inspiration',
                label: 'Reference Photo',
                source: 'google-drive',
                status: 'ready',
                url: doc.url || doc.thumbnailLink || ''
             };
             
             if (draftFormData) {
               const existing = draftFormData.images.filter(img => img.type !== 'design');
               setDraftFormData({ ...draftFormData, madeFor: optType, images: [...existing, newImg] });
             } else {
               setSelectedInitialType(optType);
               setDraftFormData({
                 id: uuidv4(),
                 name: '',
                 category: '',
                 description: '',
                 status: 'Design',
                 quantity: 1,
                 color: '',
                 material: '',
                 width: '',
                 depth: '',
                 height: '',
                 unit: 'mm',
                 scale: '',
                 is3DPrinted: true,
                 printer: '',
                 madeFor: optType,
                 series: '',
                 dateAdded: new Date().toISOString(),
                 images: [newImg],
                 printSettings: { layerHeight: '', infill: '', supports: false, raft: false, notes: '' },
                 isExtraSlotAdded: false
               });
             }
             setSharedPickerConfig(null);
          }
        });
      } catch`);
}

let block2Match = code.match(/openDrivePicker\(\{\s*slotType:\s*isMiniCharm\s*\?\s*'mini_charm'\s*:\s*type,[\s\S]*?\}\);/);
if (block2Match) {
  code = code.replace(block2Match[0], `setSharedPickerConfig({
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

        setFormData((prev: any) => {
          if (isMiniCharm) {
            return {
              ...prev,
              driveFileId: doc.id,
              driveFolderId: slotFolderId,
              images: [newDriveImage]
            };
          } else {
            const existingIndex = prev.images.findIndex((img: any) => img.type === type && (!isExtraSlot(type) || img.label === label));
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
    });`);
}

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
