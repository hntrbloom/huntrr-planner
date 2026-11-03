const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/lib/driveFolderUtils.ts', 'utf8');

if (!code.includes('wikiFolderId?: string;')) {
  code = code.replace(/boardsFolderId\?: string;/g, 'boardsFolderId?: string;\n  wikiFolderId?: string;');
}
if (!code.includes("wikiFolderId: '1_wiki_subfolder'")) {
  code = code.replace(/boardsFolderId: '1ZDWIlVnqE0X2krajrXxvF6KQgjeO7o4d',/g, "boardsFolderId: '1ZDWIlVnqE0X2krajrXxvF6KQgjeO7o4d',\n  wikiFolderId: '1_wiki_subfolder',");
}
if (!code.includes("wikiFolderId,")) {
  code = code.replace(/boardsFolderId,/g, "boardsFolderId,\n    wikiFolderId,");
}
if (!code.includes("const wikiFolderId =")) {
  code = code.replace(/const boardsFolderId = await getOrCreateFolder\(headers, 'boards', mainFolderId\);/g, "const boardsFolderId = await getOrCreateFolder(headers, 'boards', mainFolderId);\n  const wikiFolderId = await getOrCreateFolder(headers, 'wiki', mainFolderId);");
}

fs.writeFileSync('/app/applet/src/lib/driveFolderUtils.ts', code);
