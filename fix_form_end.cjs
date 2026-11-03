const fs = require('fs');
let code = fs.readFileSync('src/components/CharacterWikiView.tsx', 'utf8');

const errPicker = `      {showWikiImagePicker && (
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
      )}`;

// Remove from CharacterWikiCard
code = code.replace(errPicker, "");

// Add to CharacterForm
const formEnd = `        </div>
      </div>
    </div>
  );
}

function FormInput(`;

const newFormEnd = `        </div>
      </div>
${errPicker}
    </div>
  );
}

function FormInput(`;

code = code.replace(formEnd, newFormEnd);
fs.writeFileSync('src/components/CharacterWikiView.tsx', code);
