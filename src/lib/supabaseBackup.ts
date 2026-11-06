import { v4 as uuid } from 'uuid';
import { encodeAttachment, legacyAttachments, newBackup, type WorkspaceBackup } from './backup';
import { validateBackup } from './backupValidation';
import { openLegacySupabase } from './supabase';

const FILE_PREFIX = 'supabase://';
type SourceRecord = { path: string; data: Record<string, unknown> | null };

export async function bundleSupabaseWorkspace(owner: string, rows: SourceRecord[], readFile: (path: string) => Promise<Blob>) {
  const data: WorkspaceBackup['data'] = Object.create(null);
  for (const { path, data: record } of rows) {
    if (!record) continue;
    if (path === '') data._user = record;
    else {
      const [collection, id, ...nested] = path.split('/');
      if (!collection || !id || nested.length) throw new Error('The old account contains an unsupported record path.');
      (data[collection] ??= Object.create(null))[id] = record;
    }
  }
  const backup = newBackup(data, await legacyAttachments(data), 'supabase');
  validateBackup(backup);

  const copied = new Map<string, string>();
  async function transfer(value: unknown, field = ''): Promise<unknown> {
    if (typeof value === 'string' && /^(blob:|file:)/.test(value)) {
      throw new Error('Recover the temporary attachment in the original workspace before exporting.');
    }
    if (typeof value === 'string' && value.startsWith(FILE_PREFIX)) {
      const path = value.slice(FILE_PREFIX.length);
      if (!/^[0-9a-f-]+\/[0-9a-f-]+$/i.test(path) || !path.startsWith(owner + '/')) {
        throw new Error('An attachment belongs to a different account. Export it from its original owner.');
      }
      const kind = field === 'localFileKey' ? 'file' : 'photo';
      const cacheKey = `${kind}/${path}`;
      let key = copied.get(cacheKey);
      if (!key) {
        const blob = await readFile(path);
        key = (kind === 'file' ? 'huntrr_local_stl_' : 'photo_') + uuid();
        backup.files[key] = await encodeAttachment(blob, kind);
        copied.set(cacheKey, key);
      }
      return kind === 'file' ? key : `idb://${key}`;
    }
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const child of value) result.push(await transfer(child, field));
      return result;
    }
    if (!value || typeof value !== 'object') return value;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) result[key] = await transfer(child, key);
    return result;
  }

  backup.data = await transfer(data) as WorkspaceBackup['data'];
  return backup;
}

export async function exportExistingSupabaseWorkspace(source: 'cloud' | 'device') {
  const client = openLegacySupabase();
  if (!client) throw new Error('Legacy Supabase access is unavailable here. Use Export planner backup in the previous Organizer, then import the downloaded file.');
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('There is no existing Supabase session at this site address. Export a portable planner backup from your original Organizer.');
  const { data: { user }, error: identityError } = await client.auth.getUser();
  if (identityError || !user || user.id !== session.user.id) throw new Error('The existing account could not be verified. Export the workspace from the original Organizer.');
  const owner = user.id;
  const rows: SourceRecord[] = [];
  const cachedFiles = new Map<string, Blob>();

  if (source === 'device') {
    const { readLegacyAccountCache } = await import('./accountStore');
    const cached = await readLegacyAccountCache(owner);
    if (!cached.documents.length && !cached.files.length) throw new Error('This browser has no saved device copy for the existing account.');
    rows.push(...cached.documents);
    for (const file of cached.files) cachedFiles.set(file.path, file.blob);
  } else {
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.from('planner_documents').select('path,data')
        .eq('owner', owner).order('path').range(offset, offset + pageSize - 1);
      if (error) throw new Error('The original Supabase workspace could not be read. Check access from the old Organizer.');
      rows.push(...data);
      if (data.length < pageSize) break;
    }
  }

  const backup = await bundleSupabaseWorkspace(owner, rows, async path => {
    const cached = cachedFiles.get(path);
    if (cached) return cached;
    const { data, error } = await client.storage.from('planner-files').download(path);
    if (error || !data) throw new Error('A private Supabase attachment could not be copied. Export a portable backup from the original workspace.');
    return data;
  });
  backup.profile = { nickname: source === 'cloud' ? 'Previous Supabase workspace' : 'Supabase device copy', createdAt: new Date().toISOString() };
  return backup;
}
