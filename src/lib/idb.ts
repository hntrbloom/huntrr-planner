import { isProfileId } from './workspaceMode';
import { workspaceDatabase } from './workspaceStore';
import type { WorkspaceAttachment } from './profileStore';
import { openDB } from 'idb';

const DB_NAME = 'SereneStationeryIDB';
const DB_VERSION = 3;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keychains_files')) {
        db.createObjectStore('keychains_files');
      }
      if (!db.objectStoreNames.contains('inspiration_photos')) {
        db.createObjectStore('inspiration_photos');
      }
      if (!db.objectStoreNames.contains('drive_thumbnails')) {
        db.createObjectStore('drive_thumbnails');
      }
    },
  });
};

export interface CachedThumbnailRecord {
  fileId: string;
  blob: Blob;
  modifiedTime?: string;
  size?: number;
  cachedAt: number;
}

export const saveThumbnailToIDB = async (fileId: string, blob: Blob, modifiedTime?: string): Promise<void> => {
  try {
    const db = await initDB();
    const record: CachedThumbnailRecord = {
      fileId,
      blob,
      modifiedTime,
      size: blob.size,
      cachedAt: Date.now()
    };
    await db.put('drive_thumbnails', record, fileId);
  } catch (err) {
    console.warn('[IDB] Failed to save thumbnail to IDB:', err);
  }
};

export const getThumbnailFromIDB = async (fileId: string): Promise<CachedThumbnailRecord | undefined> => {
  try {
    const db = await initDB();
    return await db.get('drive_thumbnails', fileId);
  } catch (err) {
    console.warn('[IDB] Failed to get thumbnail from IDB:', err);
    return undefined;
  }
};

export const deleteThumbnailFromIDB = async (fileId: string): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete('drive_thumbnails', fileId);
  } catch (err) {
    console.warn('[IDB] Failed to delete thumbnail from IDB:', err);
  }
};

export const clearThumbnailsIDB = async (): Promise<void> => {
  try {
    const db = await initDB();
    await db.clear('drive_thumbnails');
  } catch (err) {
    console.warn('[IDB] Failed to clear thumbnails from IDB:', err);
  }
};

async function writeAttachment(key: string, blob: Blob, kind: WorkspaceAttachment['kind'], uid?: string) {
  if (uid && isProfileId(uid)) {
    await (await workspaceDatabase()).put('attachments', { kind, blob }, `${uid}/${key}`);
  } else {
    await (await initDB()).put(kind === 'photo' ? 'inspiration_photos' : 'keychains_files', blob, key);
  }
}

async function readAttachment(key: string, kind: WorkspaceAttachment['kind'], uid?: string): Promise<Blob | undefined> {
  if (uid && isProfileId(uid)) {
    const file: WorkspaceAttachment | undefined = await (await workspaceDatabase()).get('attachments', `${uid}/${key}`);
    return file?.kind === kind ? file.blob : undefined;
  }
  return (await initDB()).get(kind === 'photo' ? 'inspiration_photos' : 'keychains_files', key);
}

async function removeAttachment(key: string, kind: WorkspaceAttachment['kind'], uid?: string) {
  if (uid && isProfileId(uid)) {
    const db = await workspaceDatabase();
    const tx = db.transaction('attachments', 'readwrite');
    const path = `${uid}/${key}`;
    const file: WorkspaceAttachment | undefined = await tx.store.get(path);
    if (file?.kind === kind) await tx.store.delete(path);
    await tx.done;
  }
  // Legacy files can be shared by old records. Leave the original store intact.
}

export const saveFileToIDB = (key: string, file: Blob, uid?: string) => writeAttachment(key, file, 'file', uid);
export const getFileFromIDB = (key: string, uid?: string) => readAttachment(key, 'file', uid);
export const deleteFileFromIDB = (key: string, uid?: string) => removeAttachment(key, 'file', uid);
export const savePhotoToIDB = (key: string, file: Blob, uid?: string) => writeAttachment(key, file, 'photo', uid);
export const getPhotoFromIDB = (key: string, uid?: string) => readAttachment(key, 'photo', uid);
export const deletePhotoFromIDB = (key: string, uid?: string) => removeAttachment(key, 'photo', uid);

export const clearKeychainsIDB = async () => {
  const db = await initDB();
  await db.clear('keychains_files');
};

export const clearInspirationPhotosIDB = async () => {
  const db = await initDB();
  await db.clear('inspiration_photos');
};
