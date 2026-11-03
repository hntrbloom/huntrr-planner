const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

// 1. Remove state variables
code = code.replace(/const \[photoToRemove, setPhotoToRemove\] = useState<{ img: MiniFurnitureImage, type: string } \| null>\(null\);\s*const \[isRemovingPhoto, setIsRemovingPhoto\] = useState\(false\);\s*const \[deleteFromDrive, setDeleteFromDrive\] = useState\(false\);/, '');

// 2. Replace handleConfirmRemovePhoto with handleRemovePhoto
code = code.replace(/const handleConfirmRemovePhoto = async \(\) => \{[\s\S]*?setPhotoToRemove\(null\);\n\s*\}\n\s*\};\n/, `const handleRemovePhoto = (imgId: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img.id !== imgId)
    }));
  };
`);

// 3. Replace onClick for setPhotoToRemove
code = code.replace(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); e\.preventDefault\(\); setPhotoToRemove\(\{ img, type, printId: formData\.id \}\); \}\}/g, 'onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemovePhoto(img.id); }}');

// 4. Remove the photoToRemove modal JSX
code = code.replace(/\{photoToRemove && \([\s\S]*?\}\)\}/, '');

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
