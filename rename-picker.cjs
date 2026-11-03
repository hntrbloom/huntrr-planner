const fs = require('fs');

let code = fs.readFileSync('src/components/WikiDriveImagePicker.tsx', 'utf8');

// Replace component name and props
code = code.replace(/WikiDriveImagePicker/g, 'SharedDriveImagePicker');
code = code.replace(
  "export function SharedDriveImagePicker({ onClose, onSelect }: SharedDriveImagePickerProps) {",
  "export function SharedDriveImagePicker({ onClose, onSelect, folderId, title = 'Select Photo', uploadSection = 'general' }: SharedDriveImagePickerProps & { folderId: string, title?: string, uploadSection?: string }) {"
);

// Replace hardcoded wikiFolderId resolution with the prop
code = code.replace(
  /const folders = await searchOrResolveHuntrrSpaceFolders\(\);\s+const wikiFolderId = folders\.wikiFolderId;\s+if \(!wikiFolderId\) {\s+throw new Error\('Could not locate the wiki folder in Google Drive\.'\);\s+}/g,
  ""
);
code = code.replace(/driveFolderId: wikiFolderId,/g, "driveFolderId: folderId,");
code = code.replace(/section: 'wiki',/g, "section: uploadSection,");

code = code.replace(
  /const folders = await searchOrResolveHuntrrSpaceFolders\(\);\s+const wikiFolderId = folders\.wikiFolderId;\s+if \(!wikiFolderId\) {\s+setError\('Could not locate the wiki folder in Google Drive\.'\);\s+setLoading\(false\);\s+return;\s+}/g,
  ""
);
code = code.replace(
  /const query = `'.*?' in parents and trashed = false and mimeType contains 'image\/'`;/,
  "const query = `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`;"
);

code = code.replace(
  /<ImageIcon className="w-5 h-5 text-\[\#FFB8CD\]" \/> Select Wiki Photo/,
  `<ImageIcon className="w-5 h-5 text-[#FFB8CD]" /> {title}`
);

code = code.replace(
  /from your <strong>huntrr-space photos\/wiki<\/strong> Drive folder\./g,
  `from this Google Drive folder.`
);

code = code.replace(
  /<p className="text-\[16px\] font-bold text-black">No photos found in Wiki folder<\/p>/g,
  `<p className="text-[16px] font-bold text-black">No photos found in this folder</p>`
);

code = code.replace(
  /Upload image files to your <strong>huntrr-space photos\/wiki<\/strong> folder in Google Drive, then tap refresh above\./g,
  `Upload image files to this folder in Google Drive, or use the Upload Photo button, then tap refresh above.`
);

fs.writeFileSync('src/components/SharedDriveImagePicker.tsx', code);
fs.unlinkSync('src/components/WikiDriveImagePicker.tsx');
