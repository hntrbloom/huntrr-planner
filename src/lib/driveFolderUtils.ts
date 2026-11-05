import { scopedBrowserKey } from './scopedBrowserStorage';
import { getAccessToken } from './AuthContext';

export interface DriveFolderSetup {
  mainFolderId?: string;
  printsFolderId?: string;
  miniCharmsFolderId?: string;
  miniFurnitureFolderId?: string;
  figuresFolderId?: string;
  charmsFolderId?: string;
  referencesFolderId?: string;
  mockupsFolderId?: string;
  extrasFolderId?: string;
  boardsFolderId?: string;
  wikiFolderId?: string;
  modelsFolderId?: string;
  [key: string]: any;
}

export const DEFAULT_DRIVE_FOLDERS = {
  mainFolderId: '1D9aJAxtOjdGRJ7G8z3sKOb7OZAD4n9L4',
  printsFolderId: '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv',
  charmsFolderId: '1u6wQY53ko6xp41e2sNDL-DRiy6xJa-hw',
  miniCharmsFolderId: '1u6wQY53ko6xp41e2sNDL-DRiy6xJa-hw',
  miniFurnitureFolderId: '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv',
  figuresFolderId: '1Wu6BHjKxdJ5xzAQxLY5jLNa5HkDx026D',
  referencesFolderId: '1Nbtn1RAep9MoOgVHVbkKNGSg_-i7T4jp',
  mockupsFolderId: '1XaOkCP_lqGt7GnQ7VwxH6xZXjCiYo0Aa',
  extrasFolderId: '181OrBplKIJwnbEFiQExWk4BIJLAxDqHK',
  boardsFolderId: '1ZDWIlVnqE0X2krajrXxvF6KQgjeO7o4d',
  wikiFolderId: '',
  modelsFolderId: '1-im-pWjk8zldY9DdTvfIFIfAMXCNBJQE',
};

export interface PrintTypeDefinition {
  id: string;
  name: string;
  defaultFolderId: string;
  description?: string;
}

/**
 * Standard Print types used across the entire application.
 * All default folder IDs are kept as prefilled values.
 */
export const DEFAULT_PRINT_TYPES: PrintTypeDefinition[] = [
  { id: 'sets', name: 'Sets', defaultFolderId: '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv', description: 'Grouped print sets & collections' },
  { id: 'charms', name: 'Charms', defaultFolderId: '1u6wQY53ko6xp41e2sNDL-DRiy6xJa-hw', description: 'Charms with loops and clips' },
  { id: 'objects', name: 'Objects', defaultFolderId: '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv', description: 'Small accessories, decor, and props' },
  { id: 'nailCharms', name: 'Nail Charms', defaultFolderId: '1u6wQY53ko6xp41e2sNDL-DRiy6xJa-hw', description: 'Small standalone charms & nail decals' },
  { id: 'miniFurniture', name: 'Mini Furniture', defaultFolderId: '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv', description: 'Miniature furniture items & room pieces' },
  { id: 'figures', name: 'Figures', defaultFolderId: '1Wu6BHjKxdJ5xzAQxLY5jLNa5HkDx026D', description: 'Detailed characters & figurines' },
  { id: 'wiki', name: 'Wiki Characters', defaultFolderId: '', description: 'Character Wiki reference photos' },
];

/**
 * Extracts a clean Google Drive folder ID from either a raw ID string or a full Google Drive URL.
 * Automatically trims spaces and isolates the alphanumeric folder key.
 */
export function extractDriveFolderId(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Extract from /folders/ID or /d/ID
  const matchFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{15,70})/);
  if (matchFolders && matchFolders[1]) return matchFolders[1];

  const matchD = trimmed.match(/\/d\/([a-zA-Z0-9_-]{15,70})/);
  if (matchD && matchD[1]) return matchD[1];

  // Extract from ?id=ID or &id=ID
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{15,70})/);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];

  // If raw string matches ID format
  if (/^[a-zA-Z0-9_-]{15,70}$/.test(trimmed)) {
    return trimmed;
  }

  // Fallback: strip query params if any
  const noQuery = trimmed.split('?')[0].split('#')[0].trim();
  const parts = noQuery.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^[a-zA-Z0-9_-]{15,70}$/.test(lastPart)) {
    return lastPart;
  }

  return trimmed;
}

/**
 * Gets all available print types combining defaults and any custom user categories.
 */
export function getAllPrintTypes(customCategories?: string[]): PrintTypeDefinition[] {
  const list = [...DEFAULT_PRINT_TYPES];
  const knownIds = new Set(list.map(t => t.id.toLowerCase()));
  const knownNames = new Set(list.map(t => t.name.toLowerCase()));

  if (customCategories && Array.isArray(customCategories)) {
    customCategories.forEach(cat => {
      const trimmed = (cat || '').trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !knownIds.has(lower) && !knownNames.has(lower)) {
        list.push({
          id: lower.replace(/[^a-zA-Z0-9]/g, ''),
          name: trimmed,
          defaultFolderId: DEFAULT_DRIVE_FOLDERS.printsFolderId,
          description: `Custom type: ${trimmed}`
        });
        knownIds.add(lower);
        knownNames.add(lower);
      }
    });
  }

  return list;
}

/**
 * Central function to retrieve the configured Google Drive folder ID for a given Print type.
 * SINGLE SOURCE OF TRUTH across the entire app for both:
 * 1. Google Drive Picker (Choose from Drive)
 * 2. Photo Upload (saving uploaded photos to Drive)
 */
export function getPrintFolderId(printType: string | undefined | null, userSettings?: any): string {
  const rawType = (printType || '').toString().trim();
  const lower = rawType.toLowerCase();

  // Canonical key normalization
  let canonicalKey = 'miniFurniture';
  let defaultFolder = DEFAULT_DRIVE_FOLDERS.printsFolderId;

  if (lower === 'charms' || lower === 'charm') {
    canonicalKey = 'charms';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.charmsFolderId;
  } else if (
    lower === 'nail charms' || lower === 'nail charm' ||
    lower === 'nailcharm' || lower === 'nailcharms' ||
    lower === 'mini charms' || lower === 'mini charm' ||
    lower === 'minicharm' || lower === 'minicharms'
  ) {
    canonicalKey = 'nailCharms';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.miniCharmsFolderId || DEFAULT_DRIVE_FOLDERS.charmsFolderId;
  } else if (lower === 'mini furniture' || lower === 'minifurniture' || lower === 'mini_furniture') {
    canonicalKey = 'miniFurniture';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.miniFurnitureFolderId || DEFAULT_DRIVE_FOLDERS.printsFolderId;
  } else if (lower === 'figures' || lower === 'figure' || lower === 'figurines' || lower === 'figurine') {
    canonicalKey = 'figures';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.figuresFolderId;
  } else if (lower === 'objects' || lower === 'object') {
    canonicalKey = 'objects';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.printsFolderId;
  } else if (lower === 'sets' || lower === 'set') {
    canonicalKey = 'sets';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.printsFolderId;
  } else if (
    lower === 'wiki' || lower === 'wikicharacters' || lower === 'wiki characters' ||
    lower === 'characterwiki' || lower === 'character wiki' || lower === 'character' || lower === 'characters'
  ) {
    canonicalKey = 'wiki';
    defaultFolder = DEFAULT_DRIVE_FOLDERS.wikiFolderId;
  } else if (lower) {
    canonicalKey = lower.replace(/[^a-zA-Z0-9]/g, '');
  }

  // 1. Check userSettings.printFolderIds
  if (userSettings?.printFolderIds) {
    if (userSettings.printFolderIds[canonicalKey]) {
      const extracted = extractDriveFolderId(userSettings.printFolderIds[canonicalKey]);
      if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
    }
    if (userSettings.printFolderIds[rawType]) {
      const extracted = extractDriveFolderId(userSettings.printFolderIds[rawType]);
      if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
    }
    if (userSettings.printFolderIds[lower]) {
      const extracted = extractDriveFolderId(userSettings.printFolderIds[lower]);
      if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
    }
  }

  // 2. Check userSettings.driveFolders
  if (userSettings?.driveFolders) {
    const df = userSettings.driveFolders;
    if (canonicalKey === 'charms' && df.charmsFolderId) return extractDriveFolderId(df.charmsFolderId);
    if (canonicalKey === 'nailCharms' && (df.nailCharmsFolderId || df.miniCharmsFolderId)) {
      return extractDriveFolderId(df.nailCharmsFolderId || df.miniCharmsFolderId);
    }
    if (canonicalKey === 'miniFurniture' && df.miniFurnitureFolderId) return extractDriveFolderId(df.miniFurnitureFolderId);
    if (canonicalKey === 'figures' && (df.figuresFolderId || df.figureFolderId || df.figures || df.figure)) {
      const extracted = extractDriveFolderId(df.figuresFolderId || df.figureFolderId || df.figures || df.figure);
      if (extracted && extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv') return extracted;
      return DEFAULT_DRIVE_FOLDERS.figuresFolderId;
    }
    if (canonicalKey === 'objects' && df.objectsFolderId) return extractDriveFolderId(df.objectsFolderId);
    if (canonicalKey === 'sets' && (df.setsFolderId || df.printsFolderId)) return extractDriveFolderId(df.setsFolderId || df.printsFolderId);
    if (canonicalKey === 'wiki' && (df.wikiFolderId || df.wiki)) return extractDriveFolderId(df.wikiFolderId || df.wiki);
    if (df[`${canonicalKey}FolderId`]) {
      const extracted = extractDriveFolderId(df[`${canonicalKey}FolderId`]);
      if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
    }
    if (df[canonicalKey]) {
      const extracted = extractDriveFolderId(df[canonicalKey]);
      if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
    }
  }

  // 3. Check localStorage cache
  try {
    const cached = localStorage.getItem(scopedBrowserKey('huntrr_print_folder_ids'));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed[canonicalKey]) {
        const extracted = extractDriveFolderId(parsed[canonicalKey]);
        if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
      }
      if (parsed[rawType]) {
        const extracted = extractDriveFolderId(parsed[rawType]);
        if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
      }
      if (parsed[lower]) {
        const extracted = extractDriveFolderId(parsed[lower]);
        if (extracted && (canonicalKey !== 'figures' || extracted !== '19HKbZxzPmFWz0onno8YydY3uz4HJcUBv')) return extracted;
      }
    }
    if (canonicalKey === 'wiki') {
      const wikiCache = localStorage.getItem(scopedBrowserKey('huntrr_wiki_folder_id'));
      if (wikiCache) {
        const extracted = extractDriveFolderId(wikiCache);
        if (extracted) return extracted;
      }
    }
  } catch {}

  // 4. Default fallback matching
  const matched = DEFAULT_PRINT_TYPES.find(
    t => t.id.toLowerCase() === canonicalKey.toLowerCase() || t.name.toLowerCase() === lower
  );
  if (matched) {
    return matched.defaultFolderId;
  }

  return defaultFolder;
}

/**
 * Convenience helper to get Wiki Character folder ID
 */
export function getWikiFolderId(userSettings?: any): string {
  return getPrintFolderId('wiki', userSettings);
}

/**
 * Tests access to a Google Drive folder ID via Google Drive API.
 */
export async function testDriveFolderAccess(folderId: string): Promise<{ success: boolean; name?: string; error?: string }> {
  const cleanId = extractDriveFolderId(folderId);
  if (!cleanId) {
    return { success: false, error: 'Empty or invalid folder ID.' };
  }

  const token = getAccessToken();
  if (!token) {
    return { success: true, name: 'Folder ID configured (Sign in to test Drive API)' };
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?fields=id,name,mimeType,trashed`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.trashed) {
        return { success: false, error: `Folder "${data.name}" is in the Google Drive trash.` };
      }
      return { success: true, name: data.name || 'Accessible Folder' };
    }

    if (res.status === 404) {
      return { success: false, error: 'Folder not found or not shared with this Google account.' };
    }
    if (res.status === 403) {
      return { success: false, error: 'Permission denied. Ensure your Google account has access.' };
    }

    return { success: false, error: `Google Drive returned status ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error testing folder.' };
  }
}


async function getOrCreateFolder(headers: Record<string, string>, name: string, parentId?: string): Promise<string> {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\'")}'${parentQuery} and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers });
  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
  }
  
  const body: any = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const createData = await createRes.json();
  return createData.id;
}

export async function searchOrResolveHuntrrSpaceFolders(mainFolderIdOverride?: string): Promise<Required<Pick<DriveFolderSetup, 'mainFolderId' | 'printsFolderId' | 'miniCharmsFolderId' | 'boardsFolderId' | 'miniFurnitureFolderId' | 'figuresFolderId' | 'charmsFolderId' | 'referencesFolderId' | 'extrasFolderId' | 'wikiFolderId' | 'modelsFolderId'>>> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  let mainFolderId = mainFolderIdOverride;
  if (!mainFolderId) {
    mainFolderId = await getOrCreateFolder(headers, 'huntrr-space photos');
  }
  
  const printsFolderId = await getOrCreateFolder(headers, 'prints', mainFolderId);
  const boardsFolderId = await getOrCreateFolder(headers, 'boards', mainFolderId);
  const wikiFolderId = await getOrCreateFolder(headers, 'wiki', mainFolderId);
  const modelsFolderId = await getOrCreateFolder(headers, 'models', mainFolderId);
  
  const miniCharmsFolderId = await getOrCreateFolder(headers, 'mini charms', printsFolderId);
  const miniFurnitureFolderId = await getOrCreateFolder(headers, 'mini furniture', printsFolderId);
  const figuresFolderId = DEFAULT_DRIVE_FOLDERS.figuresFolderId;
  const charmsFolderId = await getOrCreateFolder(headers, 'charms', printsFolderId);
  const referencesFolderId = await getOrCreateFolder(headers, 'references', printsFolderId);
  const extrasFolderId = await getOrCreateFolder(headers, 'extras', printsFolderId);
  
  return {
    mainFolderId,
    printsFolderId,
    miniCharmsFolderId,
    boardsFolderId,
    wikiFolderId,
    modelsFolderId,
    miniFurnitureFolderId,
    figuresFolderId,
    charmsFolderId,
    referencesFolderId,
    extrasFolderId
  };
}

export async function checkAndCreateFolders(forceRepair = false): Promise<DriveFolderSetup> {
  try {
    const resolved = await searchOrResolveHuntrrSpaceFolders();
    return {
      ...DEFAULT_DRIVE_FOLDERS,
      ...resolved
    };
  } catch (err) {
    console.warn("Failed to search/create Drive folders, falling back to defaults:", err);
    return DEFAULT_DRIVE_FOLDERS;
  }
}

export async function getOrCreateBoardFolder(boardName: string, boardsFolderId: string): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const q = `mimeType='application/vnd.google-apps.folder' and name='${boardName.replace(/'/g, "\\'")}' and trashed=false and '${boardsFolderId}' in parents`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers });
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const body = {
    name: boardName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [boardsFolderId]
  };
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const createData = await createRes.json();
  return createData.id;
}

export async function renameDriveFolder(folderId: string, newName: string): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: newName })
  });
}

export async function getOrCreateMiniCharmsFolder(printsFolderId?: string): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let parentFolderId = printsFolderId;
  if (!parentFolderId) {
    try {
      const resolved = await searchOrResolveHuntrrSpaceFolders();
      parentFolderId = resolved.printsFolderId;
    } catch {
      parentFolderId = DEFAULT_DRIVE_FOLDERS.printsFolderId;
    }
  }

  const q = `mimeType='application/vnd.google-apps.folder' and (name='mini charms' or name='Mini Charms') and '${parentFolderId}' in parents and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers });
  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  const body = {
    name: 'mini charms',
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const createData = await createRes.json();
  return createData.id;
}

// Function to fetch image thumbnails
export async function getDriveImageThumbnail(fileId: string): Promise<{thumbnailLink: string, webContentLink: string} | null> {
  const token = getAccessToken();
  if (!token) return null;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,webContentLink`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) {
    return await res.json();
  }
  return null;
}

export async function getOrCreateTypeExtrasFolder(typeFolderId: string): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  const q = `mimeType='application/vnd.google-apps.folder' and name='extras' and '${typeFolderId}' in parents and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers });
  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
  }
  
  const body = { name: 'extras', mimeType: 'application/vnd.google-apps.folder', parents: [typeFolderId] };
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const createData = await createRes.json();
  return createData.id;
}

export function getModelsFolderId(userSettings?: any): string {
  if (userSettings?.driveFolders?.modelsFolderId) {
    const extracted = extractDriveFolderId(userSettings.driveFolders.modelsFolderId);
    if (extracted) return extracted;
  }
  try {
    const cached = localStorage.getItem(scopedBrowserKey('huntrr_models_folder_id'));
    if (cached) {
      const extracted = extractDriveFolderId(cached);
      if (extracted) return extracted;
    }
  } catch {}
  return DEFAULT_DRIVE_FOLDERS.modelsFolderId;
}

export async function getOrCreateModelsFolder(mainFolderId?: string): Promise<string> {
  const configuredId = getModelsFolderId();
  if (configuredId && configuredId !== '1_models_subfolder') {
    return configuredId;
  }

  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let parentId = mainFolderId;
  if (!parentId) {
    try {
      const resolved = await searchOrResolveHuntrrSpaceFolders();
      return resolved.modelsFolderId;
    } catch {
      parentId = await getOrCreateFolder(headers, 'huntrr-space photos');
    }
  }

  const folderId = await getOrCreateFolder(headers, 'models', parentId);
  try {
    localStorage.setItem(scopedBrowserKey('huntrr_models_folder_id'), folderId);
  } catch {}
  return folderId;
}

export type ModelCategoryType = 'charms' | 'nailCharms' | 'figures';

export const MODEL_CATEGORY_NAMES: Record<ModelCategoryType, string> = {
  charms: 'Charms',
  nailCharms: 'Nail Charms',
  figures: 'Figures'
};

/**
 * Dynamically resolves the Google Drive folder ID for a model category
 * (Charms, Nail Charms, Figures). Searches Drive by folder name under the Models root folder,
 * and caches the resulting folder ID.
 */
export async function getOrResolveModelCategoryFolder(category: ModelCategoryType): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Check category cache
  const cacheKey = `huntrr_models_category_${category}`;
  try {
    const cached = localStorage.getItem(scopedBrowserKey(cacheKey));
    if (cached) {
      const cleanCached = extractDriveFolderId(cached);
      if (cleanCached) return cleanCached;
    }
  } catch {}

  const modelsRootId = await getOrCreateModelsFolder();

  // Possible folder names to match in Drive
  let candidateNames: string[] = [];
  if (category === 'charms') {
    candidateNames = ['charms', 'Charms'];
  } else if (category === 'nailCharms') {
    candidateNames = ['nail charms', 'Nail Charms', 'mini charms', 'Mini Charms', 'nail_charms'];
  } else if (category === 'figures') {
    candidateNames = ['figures', 'Figures', 'figurines', 'Figurines'];
  }

  // 1. Search for existing subfolder under models root
  for (const name of candidateNames) {
    const q = `mimeType='application/vnd.google-apps.folder' and (name='${name.replace(/'/g, "\\'")}' or name='${name.toLowerCase()}' or name='${name.toUpperCase()}') and '${modelsRootId}' in parents and trashed=false`;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          const foundId = data.files[0].id;
          try { localStorage.setItem(scopedBrowserKey(cacheKey), foundId); } catch {}
          return foundId;
        }
      }
    } catch (e) {
      console.warn(`[getOrResolveModelCategoryFolder] Error querying for folder ${name}:`, e);
    }
  }

  // 2. Also search if the folder exists directly in Drive under main / prints as fallback
  for (const name of candidateNames) {
    const q = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&pageSize=5`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          const foundId = data.files[0].id;
          try { localStorage.setItem(scopedBrowserKey(cacheKey), foundId); } catch {}
          return foundId;
        }
      }
    } catch (e) {
      console.warn(`[getOrResolveModelCategoryFolder] Error fallback querying folder ${name}:`, e);
    }
  }

  // 3. If not found, create the folder inside the models root
  const primaryName = MODEL_CATEGORY_NAMES[category];
  const newFolderId = await getOrCreateFolder(headers, primaryName, modelsRootId);
  try { localStorage.setItem(scopedBrowserKey(cacheKey), newFolderId); } catch {}
  return newFolderId;
}

