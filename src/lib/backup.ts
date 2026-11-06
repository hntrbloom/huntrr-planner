import { collection, doc, getDoc, getDocs, Timestamp, workspaceDatabase, legacyWorkspaceDatabase, encodeWorkspaceValue, reviveWorkspaceValue } from './workspaceStore';
import { getFileFromIDB, getPhotoFromIDB } from './idb';
import { BACKUP_COLLECTIONS, validateBackup } from './backupValidation';
import { attachmentRange, documentRange, isLocalId, isProfileId } from './workspaceMode';
import { createProfile, type Profile, type WorkspaceAttachment } from './profileStore';

export { validateBackup } from './backupValidation';

type BackupFile = { kind: WorkspaceAttachment['kind']; dataUrl: string };
export interface WorkspaceBackup {
  format: 'huntrr.organizer';
  version: 2;
  exportedAt: string;
  storage: 'local' | 'firebase' | 'supabase';
  profile?: Pick<Profile, 'nickname' | 'createdAt'>;
  data: Record<string, any>;
  files: Record<string, BackupFile>;
}

function encode(value: any): any {
  if (value instanceof Timestamp) return { __backupTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

function decode(value: any): any {
  if (value?.__backupTimestamp) return new Timestamp(value.seconds, value.nanoseconds);
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  return value;
}

export async function encodeAttachment(blob: Blob, kind: WorkspaceAttachment['kind']): Promise<BackupFile> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  // A multiple of three keeps base64 padding confined to the final chunk.
  for (let i = 0; i < bytes.length; i += 24_576) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(i, i + 24_576))));
  }
  return { kind, dataUrl: `data:${blob.type || 'application/octet-stream'};base64,${chunks.join('')}` };
}

function referencedAttachments(data: unknown, requirePortable = false) {
  const files = new Map<string, WorkspaceAttachment['kind']>();
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      if (requirePortable && value.startsWith('supabase://')) throw new Error('This backup refers to a private Supabase file. Export a portable planner backup with the file included.');
      const key = value.replace(/^idb:\/\//, '');
      if (/^photo_[a-zA-Z0-9_.-]+$/.test(key)) files.set(key, 'photo');
      if (/^huntrr_local_stl_[a-zA-Z0-9_.-]+$/.test(key)) files.set(key, 'file');
    } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(data);
  return files;
}

export async function legacyAttachments(data: unknown) {
  const files: WorkspaceBackup['files'] = {};
  for (const [key, kind] of referencedAttachments(data)) {
    const blob = kind === 'photo' ? await getPhotoFromIDB(key) : await getFileFromIDB(key);
    if (!blob) throw new Error(`The original browser is missing a saved attachment (${key}).`);
    files[key] = await encodeAttachment(blob, kind);
  }
  return files;
}

export function newBackup(data: WorkspaceBackup['data'], files: WorkspaceBackup['files'] = {}, storage: WorkspaceBackup['storage'] = 'local'): WorkspaceBackup {
  return { format: 'huntrr.organizer', version: 2, storage, exportedAt: new Date().toISOString(), data, files };
}

export async function gatherAllData(userId: string, cloudSource?: import('firebase/firestore').Firestore | boolean): Promise<WorkspaceBackup> {
  if (!isLocalId(userId)) {
    const cloudDb = cloudSource === true ? (await import('./firebase')).db : cloudSource || undefined;
    if (!cloudDb) throw new Error('Open an existing Firebase session to export cloud data.');
    const data: WorkspaceBackup['data'] = Object.create(null);
    for (const name of BACKUP_COLLECTIONS) {
      const snap = await getDocs(collection(cloudDb, `users/${userId}/${name}`));
      data[name] = Object.fromEntries(snap.docs.map(d => [d.id, encode(d.data())]));
    }
    const root = await getDoc(doc(cloudDb, 'users', userId));
    if (root.exists()) data._user = encode(root.data());
    return newBackup(data, await legacyAttachments(data), 'firebase');
  }

  const profileId = isProfileId(userId);
  const database = profileId ? await workspaceDatabase() : await legacyWorkspaceDatabase();
  const tx = database.transaction(profileId ? ['documents', 'attachments', 'profiles'] : ['documents']);
  const docs = tx.objectStore('documents');
  const range = documentRange(userId);
  const [keys, values, fileKeys, fileValues, profile] = await Promise.all([
    docs.getAllKeys(range),
    docs.getAll(range),
    profileId ? tx.objectStore('attachments').getAllKeys(attachmentRange(userId)) : [],
    profileId ? tx.objectStore('attachments').getAll(attachmentRange(userId)) : [],
    profileId ? tx.objectStore('profiles').get(userId) as Promise<Profile | undefined> : undefined,
  ]);
  await tx.done;

  const data: WorkspaceBackup['data'] = Object.create(null);
  const prefix = `users/${userId}`;
  for (const [i, key] of keys.entries()) {
    if (key === prefix) data._user = encode(reviveWorkspaceValue(values[i]));
    else if (typeof key === 'string' && key.startsWith(prefix + '/')) {
      const [name, id, ...nested] = key.slice(prefix.length + 1).split('/');
      if (!name || !id || nested.length) throw new Error('This workspace contains an unsupported nested record.');
      (data[name] ??= Object.create(null))[id] = encode(reviveWorkspaceValue(values[i]));
    }
  }
  const files: WorkspaceBackup['files'] = profileId ? {} : await legacyAttachments(data);
  for (const [i, key] of fileKeys.entries()) {
    const { blob, kind } = fileValues[i] as WorkspaceAttachment;
    files[String(key).slice(userId.length + 1)] = await encodeAttachment(blob, kind);
  }
  for (const [key, kind] of referencedAttachments(data)) {
    if (files[key]?.kind !== kind) throw new Error(`This profile is missing a saved attachment (${key}). Recover it before exporting.`);
  }
  const backup = newBackup(data, files);
  if (profile) backup.profile = { nickname: profile.nickname, createdAt: profile.createdAt };
  return backup;
}

export async function importProfileBackup(nickname: string, backup: unknown) {
  const { data } = validateBackup(backup);
  const files: [string, WorkspaceAttachment][] = [];
  const entries = Object.entries((backup as WorkspaceBackup).files ?? {});
  const available = new Map(entries);
  for (const [key, kind] of referencedAttachments(data, true)) {
    if (available.get(key)?.kind !== kind) throw new Error(`This backup is missing a saved attachment (${key}). Export again from the original browser.`);
  }
  for (const [key, { kind, dataUrl }] of entries) {
    const [header, base64] = dataUrl.split(',', 2);
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    files.push([key, { kind, blob: new Blob([bytes], { type: header.slice(5, -7) }) }]);
  }
  const documents: [string, unknown][] = [];
  for (const [name, records] of Object.entries(data)) {
    if (name === '_user') documents.push(['', encodeWorkspaceValue(decode(records))]);
    else for (const [id, value] of Object.entries(records as Record<string, unknown>)) {
      documents.push([`${name}/${id}`, encodeWorkspaceValue(decode(value))]);
    }
  }
  return createProfile(nickname, { documents, files });
}
