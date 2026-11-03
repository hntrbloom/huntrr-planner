const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/lib/driveFolderUtils.ts', 'utf8');

const regex = /'mainFolderId' \| 'printsFolderId' \| 'miniCharmsFolderId' \| 'boardsFolderId' \| 'miniFurnitureFolderId' \| 'figuresFolderId' \| 'charmsFolderId' \| 'referencesFolderId' \| 'extrasFolderId'/g;
code = code.replace(regex, "'mainFolderId' | 'printsFolderId' | 'miniCharmsFolderId' | 'boardsFolderId' | 'miniFurnitureFolderId' | 'figuresFolderId' | 'charmsFolderId' | 'referencesFolderId' | 'extrasFolderId' | 'wikiFolderId'");

fs.writeFileSync('/app/applet/src/lib/driveFolderUtils.ts', code);
