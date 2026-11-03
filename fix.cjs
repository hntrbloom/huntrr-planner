const fs = require('fs');
let code = fs.readFileSync('src/components/MiniFurnitureView.tsx', 'utf8');

// 1. Move openDrivePicker and driveFolders hooks to top of MiniFurnitureView
const hooksToMoveRegex = /\s*const \{ openDrivePicker, pickerError: drivePickerError, setPickerError: setDrivePickerError \} = useGoogleDrivePicker\(\);\s*const \[driveFolders, setDriveFolders\] = useState<any>\(null\);\s*/;
code = code.replace(hooksToMoveRegex, '\n');

// Inject at top of MiniFurnitureView (after const [exportingSetKey...])
const insertHooksAt = /const \[exportingSetKey, setExportingSetKey\] = useState<\{url: string, storagePath\?: string\} \| null>\(null\);/;
code = code.replace(insertHooksAt, 
`const [exportingSetKey, setExportingSetKey] = useState<{url: string, storagePath?: string} | null>(null);
  const { openDrivePicker, pickerError: drivePickerError, setPickerError: setDrivePickerError } = useGoogleDrivePicker();
  const [driveFolders, setDriveFolders] = useState<any>(null);`);

// 2. Fix the global objectFit replacement.
// Let's just define objectFit generically for ALL items during renderItem map or set maps!
// Wait, for `renderItem` (list view), `item` is available.
// Let's replace `${objectFit}` with `object-cover` globally first to reset.
code = code.replace(/className=\{\`w-full h-full \$\{objectFit\}\`\}/g, 'className="w-full h-full object-cover"');

// Then carefully patch the grid view one (around line 1454)
// and sets view one (around line 1817)

fs.writeFileSync('src/components/MiniFurnitureView.tsx', code);
