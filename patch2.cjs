const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

// The replacement was probably broken because of the regex. Let's rewrite it.

code = code.replace(/const \[photoToRemove.*?useState\(false\);/, '');

const handleConfirmRemovePhotoRegex = /const handleConfirmRemovePhoto = async \(\) => \{[\s\S]*?setPhotoToRemove\(null\);\n\s*\}\n\s*\};\n/;
code = code.replace(handleConfirmRemovePhotoRegex, `const handleRemovePhoto = (imgId: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img.id !== imgId)
    }));
  };
`);

code = code.replace(/setPhotoToRemove\(\{ img, type, printId: formData\.id \}\)/g, 'handleRemovePhoto(img.id)');

code = code.replace(/\{photoToRemove && \([\s\S]*?\}\)\}\s*(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\;)/, '');

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
