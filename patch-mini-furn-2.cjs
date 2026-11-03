const fs = require('fs');

let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

const newPicker = `
        const folders = await searchOrResolveHuntrrSpaceFolders();
        setSharedPickerConfig({
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
               setDraftFormData({
                  ...draftFormData,
                  madeFor: optType,
                  images: [newImg]
               });
             } else {
               setSelectedInitialType(optType);
               setDraftFormData({
                  id: uuidv4(),
                  name: '',
                  category: categories[0] || 'Figures',
                  description: '',
                  status: 'Idea',
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
`;

code = code.replace(
  /const folders = await searchOrResolveHuntrrSpaceFolders\(\);\s*openDrivePicker\(\{[\s\S]*?\}\);\s*\} catch \(error\) \{/g,
  newPicker + "\n      } catch (error) {"
);

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
