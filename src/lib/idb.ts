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

export const saveFileToIDB = async (key: string, file: Blob) => {
  const db = await initDB();
  await db.put('keychains_files', file, key);
};

export const getFileFromIDB = async (key: string): Promise<Blob | undefined> => {
  const db = await initDB();
  return db.get('keychains_files', key);
};

export const deleteFileFromIDB = async (key: string) => {
  const db = await initDB();
  await db.delete('keychains_files', key);
};

export const savePhotoToIDB = async (key: string, file: Blob) => {
  const db = await initDB();
  await db.put('inspiration_photos', file, key);
};

export const getPhotoFromIDB = async (key: string): Promise<Blob | undefined> => {
  const db = await initDB();
  return db.get('inspiration_photos', key);
};

export const deletePhotoFromIDB = async (key: string) => {
  const db = await initDB();
  await db.delete('inspiration_photos', key);
};

export const clearKeychainsIDB = async () => {
  const db = await initDB();
  await db.clear('keychains_files');
};

export const clearInspirationPhotosIDB = async () => {
  const db = await initDB();
  await db.clear('inspiration_photos');
};
