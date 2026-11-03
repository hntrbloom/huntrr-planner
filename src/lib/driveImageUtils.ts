import { getAccessToken, setAccessToken } from './AuthContext';
import { requestFreshDriveToken } from './driveAuth';
import { getThumbnailFromIDB, saveThumbnailToIDB } from './idb';

// In-memory cache for session Object URLs (keyed by Drive fileId)
const memoryBlobCache = new Map<string, string>();

// In-progress request deduplication map
const pendingRequests = new Map<string, Promise<string>>();

/**
 * Robustly extracts a Google Drive file ID from a URL, storage path, or raw file ID string.
 */
export function extractDriveFileId(input?: string | null): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const str = input.trim();
  if (!str) return undefined;

  // 1. Direct drive:// or gdrive:// scheme
  if (str.startsWith('drive://')) {
    const id = str.replace('drive://', '').trim();
    if (id) return id;
  }
  if (str.startsWith('gdrive://')) {
    const id = str.replace('gdrive://', '').trim();
    if (id) return id;
  }

  // 2. Google Drive / Docs / Usercontent / API URLs
  const fileDMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]{15,70})/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  const dSlashMatch = str.match(/\/d\/([a-zA-Z0-9_-]{15,70})/);
  if (dSlashMatch && dSlashMatch[1]) return dSlashMatch[1];

  const filesMatch = str.match(/\/files\/([a-zA-Z0-9_-]{15,70})/);
  if (filesMatch && filesMatch[1]) return filesMatch[1];

  const idParamMatch = str.match(/[?&]id=([a-zA-Z0-9_-]{15,70})/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  const lh3Match = str.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,70})/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  // 3. Raw Drive file ID: 15 to 70 chars, alphanumeric with - and _ (no slashes, no dots, no colons)
  if (/^[a-zA-Z0-9_-]{15,70}$/.test(str) && !str.includes('/') && !str.includes('.') && !str.includes(':') && !str.includes('?')) {
    return str;
  }

  return undefined;
}

export function getCachedBlobUrl(key: string): string | undefined {
  if (!key) return undefined;
  return memoryBlobCache.get(key);
}

export function setCachedBlobUrl(key: string, blobUrl: string) {
  if (key && blobUrl) {
    memoryBlobCache.set(key, blobUrl);
  }
}

/**
 * Downloads a Google Drive file for local user saving
 */
export async function downloadDriveFile(fileId: string, filename: string): Promise<void> {
  const cleanId = extractDriveFileId(fileId) || fileId;
  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(false);
    if (token) setAccessToken(token);
  }
  if (!token) {
    throw new Error('NO_DRIVE_TOKEN');
  }
  
  const doFetch = async (authToken: string) => {
    return fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  };

  let res = await doFetch(token);

  if (res.status === 401 || res.status === 403) {
    token = await requestFreshDriveToken(false);
    if (token) {
      setAccessToken(token);
      res = await doFetch(token);
    }
  }
  
  if (!res.ok) throw new Error(`Failed to fetch Drive file for download (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'photo.webp';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fast authenticated Google Drive thumbnail resolver (aliases to fetchDriveFileWithAuth for maximum reliability).
 */
export async function fetchDriveThumbnailWithAuth(fileId: string, _width = 600): Promise<string> {
  return fetchDriveFileWithAuth(fileId);
}

/**
 * Central authenticated Drive file media resolver for full-resolution original images.
 */
export async function fetchDriveFileWithAuth(fileId: string): Promise<string> {
  const cleanId = extractDriveFileId(fileId) || fileId;
  if (!cleanId) throw new Error('Missing or invalid Drive file ID');

  const cacheKey = cleanId;

  // 1. Check memory cache
  const cached = memoryBlobCache.get(cacheKey);
  if (cached) return cached;

  // 2. Check IndexedDB cache
  try {
    const idbRecord = await getThumbnailFromIDB(cleanId);
    if (idbRecord && idbRecord.blob && idbRecord.blob.size > 0) {
      const objUrl = URL.createObjectURL(idbRecord.blob);
      memoryBlobCache.set(cacheKey, objUrl);
      return objUrl;
    }
  } catch (err) {
    console.warn('[fetchDriveFileWithAuth] IDB read failed:', err);
  }

  // 3. Check in-progress request deduplication
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    let token = getAccessToken();
    if (!token) {
      token = await requestFreshDriveToken(false);
      if (token) {
        setAccessToken(token);
      }
    }

    const endpoint = `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`;

    const doFetch = async (authToken: string | null) => {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      return fetch(endpoint, { headers });
    };

    let res = await doFetch(token);

    if (res.status === 401 || res.status === 403) {
      token = await requestFreshDriveToken(false);
      if (token) {
        setAccessToken(token);
        res = await doFetch(token);
      }
    }

    if (!res.ok) {
      throw new Error(`Drive fetch failed HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error(`Google Drive returned empty 0-byte file for ID ${cleanId}`);
    }

    const objectUrl = URL.createObjectURL(blob);
    memoryBlobCache.set(cacheKey, objectUrl);

    try {
      await saveThumbnailToIDB(cleanId, blob);
    } catch (_) {}

    return objectUrl;
  })();

  pendingRequests.set(cacheKey, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const cleanId = extractDriveFileId(fileId) || fileId;
  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(false);
    if (token) setAccessToken(token);
  }
  if (!token) {
    return false;
  }
  
  const doDelete = async (authToken: string) => {
    return fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
  };

  try {
    let res = await doDelete(token);
    if (res.status === 401 || res.status === 403) {
      token = await requestFreshDriveToken(false);
      if (token) {
        setAccessToken(token);
        res = await doDelete(token);
      }
    }
    return res.ok;
  } catch (err) {
    console.error('Failed to delete Drive file:', err);
    return false;
  }
}

export async function listImagesInDriveFolder(folderId: string): Promise<any[]> {
  const cleanFolderId = extractDriveFileId(folderId) || folderId;
  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(false);
    if (token) setAccessToken(token);
  }
  if (!token) {
    throw new Error('Not authenticated');
  }

  const q = `'${cleanFolderId}' in parents and trashed=false and mimeType contains 'image/'`;
  
  const doList = async (authToken: string) => {
    return fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size)&pageSize=100`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  };

  let res = await doList(token);

  if (res.status === 401 || res.status === 403) {
    token = await requestFreshDriveToken(false);
    if (token) {
      setAccessToken(token);
      res = await doList(token);
    }
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to list folder contents: ${res.status} ${txt}`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function fetchDriveBlobWithAuth(fileId: string): Promise<Blob> {
  const cleanId = extractDriveFileId(fileId) || fileId;
  
  const cachedBlob = await getThumbnailFromIDB(cleanId);
  if (cachedBlob && cachedBlob.blob) {
    return cachedBlob.blob;
  }

  let token = getAccessToken();
  if (!token) {
    token = await requestFreshDriveToken(false);
    if (token) setAccessToken(token);
  }

  const endpoint = `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`;

  const doFetch = async (authToken: string | null) => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return fetch(endpoint, { headers });
  };

  let res = await doFetch(token);

  if (res.status === 401 || res.status === 403 || !token) {
    token = await requestFreshDriveToken(false);
    if (token) {
      setAccessToken(token);
      res = await doFetch(token);
    }
  }

  if (!res.ok) {
    throw new Error(`Google Drive error: HTTP ${res.status}`);
  }

  const blob = await res.blob();
  if (blob.size > 0) {
    try {
      await saveThumbnailToIDB(cleanId, blob);
    } catch (_) {}
  }
  return blob;
}
