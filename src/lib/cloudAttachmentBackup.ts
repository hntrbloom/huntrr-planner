import { v4 as uuid } from 'uuid';
import { getBlob, ref } from 'firebase/storage';
import { storage } from './firebase';
import { extractDriveFileId, fetchDriveBlobWithAuth } from './driveImageUtils';
import { encodeAttachment, newBackup, validateBackup, type WorkspaceBackup } from './backup';

const firebaseHosts = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);
const driveHosts = new Set(['drive.google.com', 'docs.google.com', 'lh3.googleusercontent.com', 'www.googleapis.com']);

function isHttpsFrom(value: unknown, hosts: Set<string>): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.has(url.hostname);
  } catch { return false; }
}

const storageFields = [
  { path: 'storagePath', urls: ['url', 'downloadURL'], drive: 'driveFileId' },
  { path: 'imageStoragePath', urls: ['imageUrl'], drive: 'imageDriveFileId' },
  { path: 'photoStoragePath', urls: ['photoUrl'], drive: 'photoDriveFileId' },
  { path: 'thumbStoragePath', urls: ['thumbDownloadURL', 'thumbnailUrl'], drive: 'thumbDriveFileId' },
] as const;

function sources(record: Record<string, unknown>, fields: typeof storageFields[number]) {
  const urls = fields.urls.map(key => record[key]);
  const path = record[fields.path];
  if ([path, ...urls].some(value => typeof value === 'string' && /^(idb:\/\/|photo_)/.test(value))) return null;
  const signedUrl = urls.find(value => isHttpsFrom(value, firebaseHosts)) as string | undefined;
  const storagePath = typeof path === 'string' && /^users\/[^/]+\/.+/.test(path) ? path : undefined;
  const driveValue = record[fields.drive] ?? urls.find(value => isHttpsFrom(value, driveHosts));
  const id = typeof driveValue === 'string' ? extractDriveFileId(driveValue) : undefined;
  const driveId = id && /^[a-zA-Z0-9_-]{15,70}$/.test(id) ? id : undefined;
  return signedUrl || storagePath || driveId ? { signedUrl, storagePath, driveId } : null;
}

export function hasCloudAttachments(backup: unknown) {
  const { data } = validateBackup(backup);
  const inspect = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(inspect);
    const record = value as Record<string, unknown>;
    if (storageFields.some(fields => sources(record, fields))) return true;
    return Object.entries(record).some(([key, child]) => key !== '_originalAttachmentLinks' && inspect(child));
  };
  return inspect(data);
}

async function downloadPhoto(source: NonNullable<ReturnType<typeof sources>>): Promise<Blob> {
  if (source.signedUrl) {
    try {
      const response = await fetch(source.signedUrl, { credentials: 'omit', redirect: 'error' });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size && blob.type.startsWith('image/')) return blob;
      }
    } catch {}
  }
  if (source.storagePath) {
    try {
      const blob = await getBlob(ref(storage, source.storagePath));
      if (blob.size && blob.type.startsWith('image/')) return blob;
    } catch {}
  }
  if (source.driveId) {
    const blob = await fetchDriveBlobWithAuth(source.driveId);
    if (blob.size && blob.type.startsWith('image/')) return blob;
  }
  throw new Error('The original photo is unavailable.');
}

/** Copy cloud bytes into the export; original records and file providers are only read. */
export async function copyCloudAttachments(input: WorkspaceBackup) {
  const { data } = validateBackup(input);
  const backup = newBackup(JSON.parse(JSON.stringify(data)), { ...input.files }, input.storage ?? 'local');
  backup.profile = input.profile;
  let copied = 0;
  let unavailable = 0;
  const models = Object.values<Record<string, unknown>>(backup.data.saved_models || {});
  for (const model of models) {
    if (model.localFileKey || typeof model.driveFileId !== 'string' || !/^[a-zA-Z0-9_-]{15,70}$/.test(model.driveFileId)) continue;
    try {
      const blob = await fetchDriveBlobWithAuth(model.driveFileId);
      if (blob.size < 15 || blob.type.includes('html') || blob.type.includes('json')) throw new Error('Invalid model file');
      const key = `huntrr_local_stl_${uuid()}`;
      backup.files[key] = await encodeAttachment(blob, 'file');
      model.localFileKey = key;
      copied++;
    } catch { unavailable++; }
  }

  const transferred = new Map<string, string>();
  const visit = async (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) await visit(item);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const fields of storageFields) {
      // A saved model's Drive ID refers to the STL, never a photo.
      if (fields.path === 'storagePath' && models.includes(record)) continue;
      const source = sources(record, fields);
      if (!source) continue;
      const sourceKey = JSON.stringify(source);
      try {
        let key = transferred.get(sourceKey);
        if (!key) {
          key = `photo_${uuid()}`;
          backup.files[key] = await encodeAttachment(await downloadPhoto(source), 'photo');
          transferred.set(sourceKey, key);
          copied++;
        }
        const original = (record._originalAttachmentLinks ??= {}) as Record<string, unknown>;
        for (const field of [fields.path, ...fields.urls]) {
          if (field in record) original[field] = record[field];
          record[field] = `idb://${key}`;
        }
      } catch { unavailable++; }
    }
    for (const [key, child] of Object.entries(record)) {
      if (key !== '_originalAttachmentLinks') await visit(child);
    }
  };
  await visit(backup.data);
  return { backup, copied, unavailable };
}
