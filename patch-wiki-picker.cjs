const fs = require('fs');
let code = fs.readFileSync('src/components/WikiDriveImagePicker.tsx', 'utf8');

code = code.replace(
  "import { getAccessToken } from '../lib/AuthContext';",
  "import { getAccessToken, useAuth } from '../lib/AuthContext';\nimport { uploadImageToService } from '../lib/imageService';"
);
code = code.replace(
  "import { X, RefreshCw, AlertCircle, Image as ImageIcon, Loader2, LogIn, Check } from 'lucide-react';",
  "import { X, RefreshCw, AlertCircle, Image as ImageIcon, Loader2, LogIn, Check, Upload } from 'lucide-react';"
);

code = code.replace(
  "export function WikiDriveImagePicker({ onClose, onSelect }: WikiDriveImagePickerProps) {",
  "export function WikiDriveImagePicker({ onClose, onSelect }: WikiDriveImagePickerProps) {\n  const { user } = useAuth();\n  const [isUploading, setIsUploading] = useState(false);"
);

const uploadFn = `
  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      let token = getAccessToken();
      if (!token) {
        token = await requestFreshDriveToken(false);
      }
      if (!token) {
        throw new Error("Google Drive connection needed to upload.");
      }

      const folders = await searchOrResolveHuntrrSpaceFolders();
      const wikiFolderId = folders.wikiFolderId;
      if (!wikiFolderId) {
        throw new Error('Could not locate the wiki folder in Google Drive.');
      }
      
      const result = await uploadImageToService({
        file,
        userId: user?.uid || 'guest',
        section: 'wiki',
        filename: file.name,
        driveFolderId: wikiFolderId,
      });

      if (!result.driveFileId) {
        throw new Error("Upload succeeded but no Drive File ID was returned.");
      }

      const newImg = {
        id: result.driveFileId,
        name: file.name,
        mimeType: result.mimeType || file.type,
        thumbnailLink: result.downloadURL,
        url: result.downloadURL, 
      };

      setImages(prev => [newImg, ...prev]);
      setSelectedId(newImg.id);
      
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      setError(err.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };
`;

code = code.replace(
  "const handleUsePhoto = () => {",
  uploadFn + "\n\n  const handleUsePhoto = () => {"
);

const buttonsUi = `
          <div className="flex items-center gap-2">
            <label className={\`px-3 py-1.5 sm:px-4 bg-[#FFB8CD] hover:bg-[#FFB8CD]/90 text-white text-[13px] font-bold rounded-full cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm \${isUploading ? 'opacity-50 pointer-events-none' : ''}\`}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                disabled={isUploading}
                onChange={handleLocalUpload} 
              />
            </label>
            <button
`;

code = code.replace(
  /<div className="flex items-center gap-2">\s*<button\s*type="button"\s*onClick=\{\(e\)/,
  buttonsUi + "\n              type=\"button\"\n              onClick={(e)"
);

fs.writeFileSync('src/components/WikiDriveImagePicker.tsx', code);
