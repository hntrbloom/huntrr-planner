import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { sendAccountFile } from './accountFiles';

export type RecordData = Record<string, unknown>;
type StoredDocument = { owner: string; path: string; version: number; data: RecordData | null; revision?: string };
export type AccountRecordStamp = Pick<StoredDocument, 'version' | 'revision'>;
type Change = { path: string; expected: number; data: RecordData | null };
type QueuedWrite = { owner: string; request: string; changes: Change[]; sent?: boolean };
type QueuedFile = { owner: string; path: string; blob: Blob };
export type AccountEdit = { path: string; apply: (previous: RecordData | null) => RecordData | null };
export type SyncState = 'Saving…' | 'Saved' | 'Offline' | 'Sync failed' | 'Conflict';
type Scope = { path: string; collection: boolean };

interface AccountDatabase extends DBSchema {
  documents: { key: [string, string]; value: StoredDocument };
  scopes: { key: [string, string, number]; value: boolean };
  outbox: { key: number; value: QueuedWrite; indexes: { owner: string } };
  files: { key: [string, string]; value: QueuedFile; indexes: { owner: string } };
}

let connection: Promise<IDBPDatabase<AccountDatabase>> | undefined;
const database = () => connection ??= openDB<AccountDatabase>('huntrr.organizer.accounts', 2, {
  upgrade(db, previous) {
    if (previous < 1) {
      db.createObjectStore('documents', { keyPath: ['owner', 'path'] });
      db.createObjectStore('scopes');
      db.createObjectStore('outbox', { autoIncrement: true }).createIndex('owner', 'owner');
    }
    if (previous < 2) db.createObjectStore('files', { keyPath: ['owner', 'path'] }).createIndex('owner', 'owner');
  },
  blocking(_current, _next, event) {
    (event.target as IDBDatabase).close();
    connection = undefined;
  },
  terminated() { connection = undefined; },
}).catch(error => { connection = undefined; throw error; });

const changes = new EventTarget();
const stateChanges = new EventTarget();
const watchedScopes = new Map<string, { scope: Scope; count: number }>();
const inFlightReads = new Map<string, Promise<void>>();
const freshScopes = new Map<string, number>();
let owner: string | null = null;
let realtime: RealtimeChannel | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let activeFlush: Promise<void> | undefined;
let syncState: SyncState = 'Saved';
const invalidatedPaths = new Set<string>();
let refreshAll = false;

export const getAccountOwner = () => owner;
export const getAccountSyncState = () => syncState;
export function subscribeAccountSync(listener: () => void) {
  stateChanges.addEventListener('change', listener);
  return () => stateChanges.removeEventListener('change', listener);
}
function setState(value: SyncState) {
  if (syncState === value) return;
  syncState = value;
  stateChanges.dispatchEvent(new Event('change'));
}

function online() { return typeof navigator === 'undefined' || navigator.onLine; }
function requireOwner(account: string) {
  if (!supabase || owner !== account) throw new Error('Sign in to the account that owns this workspace.');
  return supabase;
}

export function accountRecordPath(path: string) {
  const parts = path.split('/');
  if (parts[0] !== 'users' || !parts[1]) throw new Error('Invalid account document path.');
  requireOwner(parts[1]);
  return { account: parts[1], path: parts.slice(2).join('/') };
}
const scopeKey = (account: string, scope: Scope): [string, string, number] =>
  [account, scope.path, Number(scope.collection)];

function documentRange(account: string, path: string) {
  return IDBKeyRange.bound([account, path + '/'], [account, path + '0'], false, true);
}

async function cachedScope(account: string, scope: Scope) {
  const db = await database();
  requireOwner(account);
  if (scope.collection) return db.getAll('documents', documentRange(account, scope.path));
  const row = await db.get('documents', [account, scope.path]);
  return row ? [row] : [];
}

async function refreshScope(account: string, scope: Scope) {
  const client = requireOwner(account);
  const rows: StoredDocument[] = [];
  const size = 200;
  for (let start = 0; ; start += size) {
    const query = client.from('planner_documents').select('owner,path,version,data').eq('owner', account);
    const filtered = scope.collection
      ? query.gte('path', scope.path + '/').lt('path', scope.path + '0')
      : query.eq('path', scope.path);
    const { data, error } = await filtered.order('path').range(start, start + size - 1);
    if (error) throw error;
    rows.push(...data as StoredDocument[]);
    if (data.length < size) break;
  }
  requireOwner(account);
  const db = await database();
  const tx = db.transaction(['documents', 'outbox', 'scopes'], 'readwrite');
  const pending = await tx.objectStore('outbox').index('owner').getAll(account);
  const pendingPaths = new Set(pending.flatMap(batch => batch.changes.map(change => change.path)));
  const documents = tx.objectStore('documents');
  for (const row of rows) {
    if (pendingPaths.has(row.path)) continue;
    const existing = await documents.get([account, row.path]);
    if (!existing || existing.version < row.version) await documents.put(row);
  }
  await tx.objectStore('scopes').put(true, scopeKey(account, scope));
  await tx.done;
  freshScopes.set(JSON.stringify(scopeKey(account, scope)), Date.now());
}

async function ensureScope(account: string, scope: Scope, force = false) {
  requireOwner(account);
  const key = JSON.stringify(scopeKey(account, scope));
  if (!force && Date.now() - (freshScopes.get(key) ?? 0) < 15_000) return;
  const existing = inFlightReads.get(key);
  if (existing) return existing;
  const read = (async () => {
    try {
      if (!online()) throw new Error('Offline');
      await refreshScope(account, scope);
    } catch (error) {
      const db = await database();
      if (!await db.get('scopes', scopeKey(account, scope))) throw error;
      if (owner === account && syncState !== 'Conflict') setState(online() ? 'Sync failed' : 'Offline');
    }
  })();
  inFlightReads.set(key, read);
  try { await read; } finally { inFlightReads.delete(key); }
}

export async function readAccountScope(account: string, scope: Scope) {
  await ensureScope(account, scope);
  const rows = await cachedScope(account, scope);
  requireOwner(account);
  return rows.filter(row => row.data !== null);
}

export function watchAccountScope(account: string, scope: Scope, listener: () => void) {
  requireOwner(account);
  const key = JSON.stringify(scopeKey(account, scope));
  const entry = watchedScopes.get(key) ?? { scope, count: 0 };
  entry.count++;
  watchedScopes.set(key, entry);
  const update = (event: Event) => {
    const paths = (event as CustomEvent<string[]>).detail;
    if (!paths || paths.some(path => scopeContains(scope, path))) listener();
  };
  changes.addEventListener('change', update);
  return () => {
    changes.removeEventListener('change', update);
    if (--entry.count === 0 && watchedScopes.get(key) === entry) watchedScopes.delete(key);
  };
}

function scopeContains(scope: Scope, path: string) {
  return scope.collection ? path.startsWith(scope.path + '/') : path === scope.path;
}

function scheduleRefresh(account: string, changedPath?: string) {
  if (changedPath === undefined) refreshAll = true;
  else invalidatedPaths.add(changedPath);
  clearTimeout(refreshTimer);
  // Coalesce bursts from a batch and catch up again after a connection resumes.
  refreshTimer = setTimeout(async () => {
    if (owner !== account) return;
    const paths = refreshAll ? undefined : [...invalidatedPaths];
    invalidatedPaths.clear();
    refreshAll = false;
    const scopes = [...watchedScopes.values()].map(entry => entry.scope)
      .filter(scope => !paths || paths.some(path => scopeContains(scope, path)));
    const reads = await Promise.allSettled(scopes.map(scope => ensureScope(account, scope, true)));
    if (owner !== account) return;
    if (reads.some(result => result.status === 'rejected') && syncState !== 'Conflict') setState('Sync failed');
    changes.dispatchEvent(new CustomEvent('change', { detail: paths }));
  }, changedPath === undefined ? 0 : 150);
}

export function setAccountOwner(account: string | null) {
  if (owner === account) return;
  if (realtime && supabase) void supabase.removeChannel(realtime);
  clearTimeout(flushTimer);
  clearTimeout(refreshTimer);
  watchedScopes.clear();
  freshScopes.clear();
  invalidatedPaths.clear();
  refreshAll = false;
  owner = account;
  setState(account && !online() ? 'Offline' : 'Saved');
  if (!account || !supabase) return;
  realtime = supabase.channel('planner:' + account)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'planner_documents', filter: 'owner=eq.' + account,
    }, payload => {
      const path = (payload.new as Partial<StoredDocument>).path;
      if (path !== undefined && [...watchedScopes.values()].some(({ scope }) => scopeContains(scope, path))) scheduleRefresh(account, path);
    })
    .subscribe(status => { if (status === 'SUBSCRIBED') scheduleRefresh(account); });
  scheduleFlush(account);
}

async function ensureDocument(account: string, path: string) {
  const db = await database();
  // Use the version the editor observed. Fetching a newer version here would
  // turn a stale edit into an overwrite instead of a version conflict.
  if (await db.get('documents', [account, path])) return;
  if (await db.get('scopes', scopeKey(account, { path, collection: false }))) return;
  const parent = path.split('/').slice(0, -1).join('/');
  if (path && await db.get('scopes', scopeKey(account, { path: parent, collection: true }))) return;
  await ensureScope(account, { path, collection: false });
}

export async function editAccountDocuments(
  account: string, edits: AccountEdit[],
  readVersions?: ReadonlyMap<string, AccountRecordStamp>,
) {
  requireOwner(account);
  if (!edits.length) return;
  if (edits.length > 400) throw new Error('This change contains too many records to save at once.');
  await Promise.all(edits.map(edit => ensureDocument(account, edit.path)));
  const db = await database();
  requireOwner(account);
  const tx = db.transaction(['documents', 'outbox'], 'readwrite');
  try {
    const documents = tx.objectStore('documents');
    const outbox = tx.objectStore('outbox');
    const batch: Change[] = [];
    for (const [path, stamp] of readVersions ?? []) {
      const current = await documents.get([account, path]);
      if ((current?.version ?? 0) !== stamp.version || current?.revision !== stamp.revision) {
        throw new Error('This record changed while editing. Please try again.');
      }
    }
    const latest = await outbox.index('owner').openCursor(account, 'prev');
    const prior = latest?.value;
    const coalesce = edits.length === 1 && prior && !prior.sent && prior.changes.length === 1 &&
      prior.changes[0].path === edits[0].path;
    for (const edit of edits) {
      const previous = await documents.get([account, edit.path]);
      const data = edit.apply(previous?.data ?? null);
      const expected = coalesce ? prior.changes[0].expected : previous?.version ?? 0;
      batch.push({ path: edit.path, expected, data });
      await documents.put({ owner: account, path: edit.path, version: expected + 1, data, revision: crypto.randomUUID() });
    }
    if (coalesce && latest) await latest.update({ ...prior, changes: batch });
    else await outbox.add({ owner: account, request: crypto.randomUUID(), changes: batch });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* Transaction already ended. */ }
    await tx.done.catch(() => {});
    throw error;
  }
  if (owner === account) {
    if (syncState !== 'Conflict') setState(online() ? 'Saving…' : 'Offline');
    changes.dispatchEvent(new CustomEvent('change', { detail: edits.map(edit => edit.path) }));
    scheduleFlush(account);
  }
}

export async function readAccountVersion(account: string, path: string) {
  await ensureDocument(account, path);
  const row = await (await database()).get('documents', [account, path]);
  requireOwner(account);
  return row;
}

export async function queueAccountFile(account: string, path: string, blob: Blob) {
  requireOwner(account);
  const db = await database();
  requireOwner(account);
  await db.put('files', { owner: account, path, blob });
  if (owner === account) {
    if (syncState !== 'Conflict') setState(online() ? 'Saving…' : 'Offline');
    scheduleFlush(account);
  }
}

export async function readQueuedAccountFile(account: string, path: string) {
  requireOwner(account);
  const file = await (await database()).get('files', [account, path]);
  requireOwner(account);
  return file?.blob;
}

function scheduleFlush(account: string, delay = 350) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { if (owner === account) void syncAccountNow(); }, delay);
}

async function flush(account: string) {
  if (!online()) { setState('Offline'); return; }
  try {
    const db = await database();
    while (owner === account) {
      const tx = db.transaction(['outbox', 'files'], 'readwrite');
      const cursor = await tx.objectStore('outbox').index('owner').openCursor(account);
      const file = await tx.objectStore('files').index('owner').openCursor(account);
      if (!file && cursor && !cursor.value.sent) await cursor.update({ ...cursor.value, sent: true });
      await tx.done;
      if (owner !== account) return;
      if (file) {
        setState('Saving…');
        await sendAccountFile(account, file.value.path, file.value.blob);
        await db.delete('files', file.primaryKey);
        continue;
      }
      if (!cursor) { setState('Saved'); return; }
      setState('Saving…');
      const write = cursor.value;
      const { error } = await requireOwner(account).rpc('planner_apply', {
        p_owner: account, p_request: write.request, p_changes: write.changes,
      });
      if (error) {
        if (owner !== account) return;
        setState(error.code === '40001' ? 'Conflict' : online() ? 'Sync failed' : 'Offline');
        if (error.code !== '40001' && online()) scheduleFlush(account, 15_000);
        return;
      }
      await db.delete('outbox', cursor.primaryKey);
    }
  } catch {
    if (owner === account) {
      setState(online() ? 'Sync failed' : 'Offline');
      if (online()) scheduleFlush(account, 15_000);
    }
  }
}

export async function syncAccountNow() {
  const account = owner;
  if (!account) return;
  if (activeFlush) await activeFlush;
  if (owner !== account) return;
  if (!activeFlush) {
    activeFlush = flush(account).finally(() => { activeFlush = undefined; });
  }
  await activeFlush;
}

export async function getPendingAccountWrites(account: string) {
  requireOwner(account);
  return (await database()).getAllFromIndex('outbox', 'owner', account);
}

async function clearAccountCache(account: string, includeFiles: boolean) {
  const db = await database();
  const tx = db.transaction(['documents', 'scopes', 'outbox', 'files'], 'readwrite');
  const range = IDBKeyRange.bound([account], [account, []], false, true);
  await tx.objectStore('documents').delete(range);
  await tx.objectStore('scopes').delete(range);
  const outbox = tx.objectStore('outbox');
  for (const key of await outbox.index('owner').getAllKeys(account)) await outbox.delete(key);
  if (includeFiles) await tx.objectStore('files').delete(range);
  await tx.done;
}

export const forgetAccountCache = (account: string) => clearAccountCache(account, true);

export async function resolveUsingCloud(account: string) {
  requireOwner(account);
  if (syncState !== 'Conflict') throw new Error('There is no sync conflict to resolve.');
  clearTimeout(flushTimer);
  if (activeFlush) await activeFlush;
  requireOwner(account);
  await clearAccountCache(account, false);
  freshScopes.clear();
  scheduleRefresh(account);
  setState('Saved');
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => { if (owner) setState('Offline'); });
  window.addEventListener('online', () => { if (owner) { scheduleFlush(owner, 0); scheduleRefresh(owner); } });
  window.addEventListener('focus', () => { if (owner) scheduleRefresh(owner); });
}
