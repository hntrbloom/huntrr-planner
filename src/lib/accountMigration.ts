import { getBlob, ref } from 'firebase/storage';
import { validateBackup } from './backupValidation';
import { ACCOUNT_FILE_PREFIX, readAccountFile, uploadAccountFile } from './accountFiles';
import { getAccountOwner, getPendingAccountWrites } from './accountStore';
import { supabase } from './supabase';
import { LOCAL_USER_ID } from './workspaceMode';
import { hasLocalWorkspaceRecords } from './workspaceStore';

export const readBackup = (file: File) => file.text().then(text => JSON.parse(text));

const legacyCollections = {
  guest_appointments: 'appointments', guest_medication_logs: 'medications',
  serene_boards: 'boards', serene_photos: 'photos', huntrr_saved_models_guest: 'saved_models',
};
const legacyPreferences = ['characterWikiData', 'habitsData', 'guest_job_applications', 'guest_local_companies', 'guest_remote_companies', 'job_sync_meta', 'job_weekly_goal', 'focus_timer_state'];

export async function hasBrowserBackup() {
  return await hasLocalWorkspaceRecords() ||
    [...Object.keys(legacyCollections), ...legacyPreferences].some(key => localStorage.getItem(key) !== null);
}

export async function browserBackup() {
  const { gatherAllData } = await import('./backup');
  const backup = await gatherAllData(LOCAL_USER_ID);
  const parse = (key: string) => {
    const value = localStorage.getItem(key);
    if (value === null) return undefined;
    try { return JSON.parse(value); } catch { throw new Error('Browser data for ' + key + ' could not be read.'); }
  };
  for (const [key, name] of Object.entries(legacyCollections)) {
    const records = parse(key);
    if (!Array.isArray(records) || Object.keys(backup.data[name] ?? {}).length) continue;
    backup.data[name] = Object.fromEntries(records.filter(item => item?.id).map(item => [String(item.id), item]));
  }
  const preferences = backup.data.preferences ??= {};
  const characters = parse('characterWikiData');
  const habits = parse('habitsData');
  const applications = parse('guest_job_applications');
  const weeklyGoal = parse('job_weekly_goal');
  const focus = parse('focus_timer_state');
  if (characters?.length && !preferences.characterWiki) preferences.characterWiki = { characters };
  if (habits?.length && !preferences.habitsData) preferences.habitsData = { habits };
  if (applications?.length && !preferences.jobApplicationsData) preferences.jobApplicationsData = {
    applications, localCompanies: parse('guest_local_companies') ?? [],
    remoteCompanies: parse('guest_remote_companies') ?? [], syncMeta: parse('job_sync_meta') ?? {},
  };
  if (Number.isFinite(weeklyGoal) && !preferences.jobStreakConfig) preferences.jobStreakConfig = { weeklyGoal };
  if (focus && !preferences.focusSettings) {
    const settings = Object.fromEntries(['duration', 'soundsEnabled', 'notificationsEnabled', 'volume']
      .filter(key => typeof focus[key] === 'number' || typeof focus[key] === 'boolean').map(key => [key, focus[key]]));
    if (Object.keys(settings).length) preferences.focusSettings = settings;
  }
  // The older browser preview can reference the same IndexedDB attachment store.
  async function includeFiles(value: unknown) {
    if (typeof value === 'string' && (value.startsWith('idb://') || value.startsWith('huntrr_local_stl_'))) {
      const key = value.replace(/^idb:\/\//, '');
      if (backup.files[key]) return;
      const { getFileFromIDB, getPhotoFromIDB } = await import('./idb');
      const kind = value.startsWith('idb://') ? 'photo' : 'file';
      const blob = await (kind === 'photo' ? getPhotoFromIDB(key) : getFileFromIDB(key));
      if (!blob) throw new Error('A browser attachment is missing. Recover it in the original workspace before importing.');
      backup.files[key] = { kind, dataUrl: await toDataURL(blob) };
    } else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) await includeFiles(item);
    }
  }
  await includeFiles(backup.data);
  return backup;
}

function firebaseMedia(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com';
  } catch { return false; }
}

function toDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function downloadMedia(url: string) {
  const result = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(30_000) });
  if (!result.ok) throw new Error('An attachment could not be downloaded. Reopen it in the original workspace before exporting.');
  return result.blob();
}

// Run from the account that currently owns the data. Only the downloaded copy is rewritten.
export async function portableBackup(userId: string, legacySource = false) {
  const { gatherAllData } = await import('./backup');
  const backup = await gatherAllData(userId, legacySource);
  const packed = new Map<string, string>();
  async function pack(reference: string, kind: 'photo' | 'file', read: () => Promise<Blob>) {
    const cached = packed.get(reference);
    if (cached) return cached;
    const key = (kind === 'file' ? 'huntrr_local_stl_' : 'photo_') + crypto.randomUUID();
    backup.files[key] = { kind, dataUrl: await toDataURL(await read()) };
    const result = kind === 'file' ? key : 'idb://' + key;
    packed.set(reference, result);
    return result;
  }
  async function visit(value: any, field = ''): Promise<any> {
    if (typeof value === 'string') {
      if (value.startsWith('idb://') || value.startsWith('huntrr_local_stl_')) {
        const key = value.replace(/^idb:\/\//, '');
        if (!backup.files[key]) {
          const { getPhotoFromIDB, getFileFromIDB } = await import('./idb');
          const kind = value.startsWith('idb://') ? 'photo' : 'file';
          const blob = await (kind === 'photo' ? getPhotoFromIDB(key) : getFileFromIDB(key));
          if (!blob) throw new Error('A browser attachment is missing. Recover it on the original device before exporting.');
          backup.files[key] = { kind, dataUrl: await toDataURL(blob) };
        }
        return value;
      }
      if (value.startsWith('blob:') || value.startsWith('file:')) {
        throw new Error('A temporary attachment needs recovery in the original workspace before export. Original data has been kept.');
      }
      if (value.startsWith(ACCOUNT_FILE_PREFIX)) {
        return pack(value, field === 'localFileKey' ? 'file' : 'photo', () => readAccountFile(value));
      }
      if (firebaseMedia(value)) return pack(value, 'photo', () => downloadMedia(value));
      return value;
    }
    if (Array.isArray(value)) {
      const output = [];
      for (const item of value) output.push(await visit(item, field));
      return output;
    }
    if (!value || typeof value !== 'object') return value;
    const output: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) output[key] = await visit(child, key);
    if (value.driveFileId && value.originalFilename && !output.localFileKey) {
      output.localFileKey = await pack(value.driveFileId, 'file', async () => {
        const { fetchDriveSTLArrayBuffer } = await import('./stlDriveService');
        return new Blob([await fetchDriveSTLArrayBuffer(value.driveFileId)], { type: 'model/stl' });
      });
    } else if (value.driveFileId && !value.originalFilename && ![output.url, output.downloadURL, output.storagePath].some(url => typeof url === 'string' && url.startsWith('idb://'))) {
      const url = await pack(value.driveFileId, 'photo', () => downloadDrivePhoto(value.driveFileId));
      output.storagePath = url;
      if ('downloadURL' in value) output.downloadURL = url;
      else output.url = url;
    } else if (typeof value.storagePath === 'string' && /^users\/[^/]+\//.test(value.storagePath) && !output.downloadURL && !output.url) {
      output.storagePath = await pack(value.storagePath, 'photo', async () => {
        const { storage } = await import('./firebase');
        return getBlob(ref(storage, value.storagePath));
      });
    }
    if (value.thumbDriveFileId && !output.thumbDownloadURL?.startsWith('idb://')) {
      const thumb = await pack(value.thumbDriveFileId, 'photo', () => downloadDrivePhoto(value.thumbDriveFileId));
      output.thumbDownloadURL = output.thumbStoragePath = thumb;
    }
    return output;
  }
  backup.data = await visit(backup.data);
  return backup;
}

async function downloadDrivePhoto(fileId: string) {
  const { fetchDriveFileWithAuth } = await import('./driveImageUtils');
  return downloadMedia(await fetchDriveFileWithAuth(fileId));
}

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}
const sameData = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export async function importIntoAccount(account: string, backup: any) {
  const { data } = validateBackup(backup);
  if (!supabase || getAccountOwner() !== account) throw new Error('Confirm the destination account before importing.');
  if ((await getPendingAccountWrites(account)).length) throw new Error('Finish syncing pending changes before importing.');
  const files = new Map<string, string>();
  for (const [key, file] of Object.entries<any>(backup.files || {})) {
    const blob = await (await fetch(file.dataUrl)).blob();
    files.set(key, await uploadAccountFile(account, blob, true));
  }
  async function prepare(value: any): Promise<any> {
    if (typeof value === 'string') {
      const key = value.replace(/^idb:\/\//, '');
      if (files.has(key)) return files.get(key);
      if (value.startsWith(ACCOUNT_FILE_PREFIX)) throw new Error('Export a portable backup to transfer private cloud attachments.');
      if (value.startsWith('idb://') || value.startsWith('huntrr_local_stl_') || value.startsWith('blob:')) {
        throw new Error('This backup references a missing attachment. Export a portable backup from the original workspace.');
      }
      if (firebaseMedia(value)) {
        const stored = await uploadAccountFile(account, await downloadMedia(value), true);
        files.set(key, stored);
        return stored;
      }
      return value;
    }
    if (Array.isArray(value)) {
      const output = [];
      for (const item of value) output.push(await prepare(item));
      return output;
    }
    if (!value || typeof value !== 'object') return value;
    if (value.__backupTimestamp) return { __workspaceTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
    const output: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) output[key] = await prepare(child);
    const privateFile = [output.url, output.downloadURL, output.storagePath, output.localFileKey].find(url => typeof url === 'string' && url.startsWith(ACCOUNT_FILE_PREFIX + account + '/'));
    if (value.driveFileId && !privateFile) throw new Error('This backup contains a Drive attachment. Export a portable backup from the original workspace first.');
    if (privateFile) {
      if (value.storagePath) output.storagePath = privateFile;
      delete output.driveFileId;
    }
    if (output.thumbDownloadURL?.startsWith(ACCOUNT_FILE_PREFIX)) {
      output.thumbStoragePath = output.thumbDownloadURL;
      delete output.thumbDriveFileId;
    }
    return output;
  }
  const records: { path: string; data: Record<string, unknown> }[] = [];
  for (const [collection, items] of Object.entries<any>(data)) {
    if (collection === '_user') records.push({ path: '', data: await prepare(items) });
    else for (const [id, value] of Object.entries(items)) records.push({ path: collection + '/' + id, data: await prepare(value) });
  }
  const result = { imported: 0, alreadyPresent: 0, skipped: 0 };
  for (let start = 0; start < records.length; start += 25) {
    if (getAccountOwner() !== account) throw new Error('The destination account changed.');
    const batch = records.slice(start, start + 25);
    const paths = batch.map(record => record.path);
    const existing = await supabase.from('planner_documents').select('path,data').eq('owner', account).in('path', paths);
    if (existing.error) throw existing.error;
    const byPath = new Map(existing.data.map(row => [row.path, row.data]));
    const missing = batch.filter(record => !byPath.has(record.path));
    for (const record of batch) {
      if (!byPath.has(record.path)) continue;
      if (sameData(byPath.get(record.path), record.data)) result.alreadyPresent++;
      else result.skipped++;
    }
    if (!missing.length) continue;
    const write = await supabase.rpc('planner_apply', {
      p_owner: account, p_request: crypto.randomUUID(),
      p_changes: missing.map(record => ({ ...record, expected: 0 })),
    });
    if (write.error) throw write.error;
    const check = await supabase.from('planner_documents').select('path,data').eq('owner', account).in('path', missing.map(record => record.path));
    if (check.error) throw check.error;
    const verified = new Map(check.data.map(row => [row.path, row.data]));
    if (missing.some(record => !sameData(verified.get(record.path), record.data))) throw new Error('A cloud copy could not be verified. Keep the original and retry.');
    result.imported += missing.length;
  }
  return result;
}
