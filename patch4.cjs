const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

// Find where to insert handleRemovePhoto
if (!code.includes('const handleRemovePhoto =')) {
  code = code.replace(/(const \[formData, setFormData\] = [^;]+;)/, `$1\n  const handleRemovePhoto = (imgId: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((img: any) => img.id !== imgId)
    }));
  };`);
}

// Check if handleConfirmRemovePhoto is still there
code = code.replace(/const handleConfirmRemovePhoto = async \(\) => \{[\s\S]*?(?=\s*const handleSave = async)/, '');

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
