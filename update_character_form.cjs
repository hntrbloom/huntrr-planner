const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

// 1. Import WikiDriveImagePicker
if (!code.includes('WikiDriveImagePicker')) {
  code = code.replace(
    "import { EntitySelector } from './EntitySelector';",
    "import { EntitySelector } from './EntitySelector';\nimport { WikiDriveImagePicker } from './WikiDriveImagePicker';"
  );
}

// 2. Add state to CharacterForm
const formRegex = /function CharacterForm\(\{([^}]+)\}: \{([^}]+)\}\) \{/;
if (!code.includes('showWikiImagePicker')) {
  code = code.replace(
    formRegex,
    (match) => match + "\n  const [showWikiImagePicker, setShowWikiImagePicker] = useState(false);\n"
  );
}

// 3. Replace ImageUploaderArea for Main Image with a button
const oldImageArea = `<ImageUploaderArea
              onUpload={(files) => {
                if (files && files.length > 0) {
                  handleMainImageUpload({ target: { files } });
                }
              }}
              className="w-full box-border"
            >
              <div className="w-full aspect-square max-w-[170px] mx-auto md:mx-0 bg-[#FFF0F4] rounded-xl border-2 border-dashed border-[#FFB8CD] flex flex-col items-center justify-center relative overflow-hidden group wiki-character-image-container">
              {formData.imageUrl ? (
                <>
                  <WikiImage url={formData.imageUrl} storagePath={formData.imageStoragePath} alt="Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-bold text-[12px]">Change Image</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-3">
                  <ImageIcon className="w-8 h-8 text-[#FFB8CD] mx-auto mb-1" />
                  <span className="text-[#FFB8CD] font-bold text-[12px]">Upload Image</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleMainImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </ImageUploaderArea>`;

const newImageArea = `<div 
              className="w-full aspect-square max-w-[170px] mx-auto md:mx-0 bg-[#FFF0F4] rounded-xl border-2 border-dashed border-[#FFB8CD] flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer wiki-character-image-container hover:border-[#FFB8CD]/80 transition-colors"
              onClick={() => setShowWikiImagePicker(true)}
            >
              {formData.imageUrl ? (
                <>
                  <WikiImage url={formData.imageUrl} storagePath={formData.imageStoragePath} alt="Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-bold text-[12px]">Choose Photo</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-3">
                  <ImageIcon className="w-8 h-8 text-[#FFB8CD] mx-auto mb-1" />
                  <span className="text-[#FFB8CD] font-bold text-[12px]">Choose Photo</span>
                </div>
              )}
            </div>`;

code = code.replace(oldImageArea, newImageArea);

// 4. Render the picker in CharacterForm
const endOfForm = "        </div>\n      </div>\n    </div>\n  );\n}";
const newEndOfForm = `        </div>
      </div>
      {showWikiImagePicker && (
        <WikiDriveImagePicker
          onClose={() => setShowWikiImagePicker(false)}
          onSelect={(img) => {
            setFormData(prev => ({
              ...prev,
              imageUrl: img.url || img.thumbnailLink,
              imageStoragePath: img.id
            }));
            setShowWikiImagePicker(false);
          }}
        />
      )}
    </div>
  );
}`;

if (!code.includes('<WikiDriveImagePicker')) {
  code = code.replace(endOfForm, newEndOfForm);
}

fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
