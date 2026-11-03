const fs = require('fs');

let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

// Add sharedPickerConfig to main component
code = code.replace(
  "const [selectedInitialType, setSelectedInitialType] = useState<string | undefined>(undefined);",
  "const [selectedInitialType, setSelectedInitialType] = useState<string | undefined>(undefined);\n  const [sharedPickerConfig, setSharedPickerConfig] = useState<any>(null);"
);

// Add rendering to the end of main component
code = code.replace(
  /\{isTypeSelectorOpen && \(/,
  `{sharedPickerConfig?.isOpen && (
        <SharedDriveImagePicker
          folderId={sharedPickerConfig.folderId}
          title={sharedPickerConfig.title}
          uploadSection={sharedPickerConfig.uploadSection}
          onClose={() => setSharedPickerConfig(null)}
          onSelect={sharedPickerConfig.onSelect}
        />
      )}
      {isTypeSelectorOpen && (`
);

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
