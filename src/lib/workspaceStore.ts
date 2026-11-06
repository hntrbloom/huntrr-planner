import { sanitizeFirestorePayload } from './firestoreUtils';
import * as cloud from 'firebase/firestore';
import { openDB } from 'idb';
import { isLocalPath, LOCAL_USER_ID } from './workspaceMode';

// Keep cloud references, paths and all existing user data intact. Only the explicit
// local workspace namespace is handled by IndexedDB; failures never fall back to cloud.
export * from 'firebase/firestore';
export const legacyWorkspaceDatabase = () => openDB('huntrr.organizer.workspace', 1, {
  upgrade(db) { db.createObjectStore('documents'); },
});
export async function hasLocalWorkspaceRecords() {
  return (await (await legacyWorkspaceDatabase()).count('documents', IDBKeyRange.bound(
    'users/huntrr-local-workspace', 'users/huntrr-local-workspace0', false, true,
  ))) > 0;
}

export const workspaceDatabase = () => openDB('huntrr.organizer.profiles', 1, {
  upgrade(db) {
    db.createObjectStore('documents');
    db.createObjectStore('profiles');
    db.createObjectStore('profileSettings');
    db.createObjectStore('attachments');
  },
});
const changes = new EventTarget();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('huntrr.organizer.workspace') : null;
(channel as any)?.unref?.();
channel?.addEventListener('message', () => changes.dispatchEvent(new Event('change')));
const notify = () => { changes.dispatchEvent(new Event('change')); channel?.postMessage('change'); };
type Constraint = { kind: string; args: any[] };
const constraints = new WeakMap<object, Constraint>();
const queries = new WeakMap<object, { path: string; constraints: Constraint[] }>();
const fields = new WeakMap<object, Constraint>();
function report(error: unknown): never {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('workspace-storage-error', {
    detail: error instanceof Error ? error.message : 'Check your connection and browser storage, then try again.',
  }));
  throw error;
}
const pathOf = (ref: any): string => queries.get(ref)?.path || ref.path || '';
const local = (ref: any) => isLocalPath(pathOf(ref));
const namespace = (ref: any) => pathOf(ref).split('/')[1];
const database = (ref: any) => namespace(ref) === LOCAL_USER_ID ? legacyWorkspaceDatabase() : workspaceDatabase();
export const reviveWorkspaceValue = (value: any): any => {
  if (value?.__workspaceTimestamp) return new cloud.Timestamp(value.seconds, value.nanoseconds);
  if (Array.isArray(value)) return value.map(reviveWorkspaceValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveWorkspaceValue(v)]));
  return value;
};
export function encodeWorkspaceValue(value: any, previous?: any): any {
  const transform = value && typeof value === 'object' ? fields.get(value) : undefined;
  if (transform?.kind === 'timestamp') return encodeWorkspaceValue(cloud.Timestamp.now());
  if (transform?.kind === 'union') return [...(previous || []), ...transform.args.filter(v => !(previous || []).some((p: any) => JSON.stringify(p) === JSON.stringify(v)))].map(v => encodeWorkspaceValue(v));
  if (transform?.kind === 'remove') return (previous || []).filter((p: any) => !transform.args.some(v => JSON.stringify(p) === JSON.stringify(v))).map((v: any) => encodeWorkspaceValue(v));
  if (value instanceof cloud.Timestamp) return { __workspaceTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof Date) return encodeWorkspaceValue(cloud.Timestamp.fromDate(value));
  if (Array.isArray(value)) return value.map((v, i) => encodeWorkspaceValue(v, previous?.[i]));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeWorkspaceValue(v, previous?.[k])]));
  return value;
}
const snapshot = (ref: any, value: any) => ({
  id: ref.id, ref, exists: () => value !== undefined, data: () => reviveWorkspaceValue(value),
  get: (field: string) => field.split('.').reduce((v, key) => v?.[key], reviveWorkspaceValue(value)),
  metadata: { fromCache: true, hasPendingWrites: false },
});
async function readDocument(ref: any) {
  return snapshot(ref, await (await database(ref)).get('documents', ref.path));
}
async function readQuery(ref: any) {
  const db = await database(ref);
  const tx = db.transaction('documents');
  const path = pathOf(ref);
  const range = IDBKeyRange.bound(path + '/', path + '0', false, true);
  const [keys, values] = await Promise.all([tx.store.getAllKeys(range), tx.store.getAll(range)]);
  let docs = keys.flatMap((key, i) => typeof key === 'string' && key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/') ? [snapshot(cloud.doc(ref.firestore, key), values[i])] : []);
  for (const rule of queries.get(ref)?.constraints || []) {
    const [field, op, value] = rule.args;
    const get = (d: any) => typeof field !== 'string' && field.isEqual?.(cloud.documentId()) ? d.id : d.get(field);
    if (rule.kind === 'where') docs = docs.filter(d => {
      const actual = get(d);
      switch (op) {
        case '==': return actual === value;
        case '!=': return actual !== value;
        case '>=': return actual >= value;
        case '<=': return actual <= value;
        case '>': return actual > value;
        case '<': return actual < value;
        case 'in': return value.includes(actual);
        case 'array-contains': return actual?.includes(value);
        default: throw new Error(`Unsupported local query operator: ${op}`);
      }
    });
    if (rule.kind === 'order') docs.sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * (op === 'desc' ? -1 : 1));
  }
  for (const rule of queries.get(ref)?.constraints || []) if (rule.kind === 'limit') docs = docs.slice(0, rule.args[0]);
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb: any) => docs.forEach(cb), metadata: { fromCache: true, hasPendingWrites: false } };
}
function constraint(kind: string, fn: any, args: any[]) { const result = fn(...args); constraints.set(result, { kind, args }); return result; }
export const where: typeof cloud.where = ((...args: any[]) => constraint('where', cloud.where, args)) as any;
export const orderBy: typeof cloud.orderBy = ((...args: any[]) => constraint('order', cloud.orderBy, args)) as any;
export const limit: typeof cloud.limit = ((...args: any[]) => constraint('limit', cloud.limit, args)) as any;
export const query: typeof cloud.query = ((ref: any, ...rules: any[]) => {
  const result = cloud.query(ref, ...rules);
  queries.set(result, { path: pathOf(ref), constraints: [...(queries.get(ref)?.constraints || []), ...rules.map(r => constraints.get(r)).filter(Boolean) as Constraint[]] });
  return result;
}) as any;
export const getDoc: typeof cloud.getDoc = ((ref: any) => local(ref) ? readDocument(ref) : cloud.getDoc(ref)) as any;
export const getDocs: typeof cloud.getDocs = ((ref: any) => local(ref) ? readQuery(ref) : cloud.getDocs(ref)) as any;
export const onSnapshot: typeof cloud.onSnapshot = ((ref: any, ...args: any[]) => {
  if (!local(ref)) return (cloud.onSnapshot as any)(ref, ...args);
  const next = typeof args[0] === 'function' ? args[0] : args[0].next?.bind(args[0]);
  const error = args[1] || args[0].error?.bind(args[0]);
  let active = true;
  const update = () => (ref.type === 'document' ? readDocument(ref) : readQuery(ref)).then(s => { if (active) next?.(s); }).catch(e => { if (active) { if (error) error(e); else { try { report(e); } catch {} } } });
  changes.addEventListener('change', update); update();
  return () => { active = false; changes.removeEventListener('change', update); };
}) as any;
type Operation = { kind: 'set' | 'update' | 'delete'; ref: any; data?: any; options?: any };
async function commit(operations: Operation[]) {
  if (!operations.length) return;
  const first = operations[0].ref;
  if (operations.some(op => !local(op.ref) || namespace(op.ref) !== namespace(first))) {
    throw new Error('A local batch must belong to one profile.');
  }
  const db = await database(first);
  const tx = db.transaction('documents', 'readwrite');
  try {
    for (const op of operations) {
      if (!local(op.ref)) throw new Error('Local writes must stay inside the local workspace.');
      if (op.kind === 'delete') { await tx.store.delete(op.ref.path); continue; }
      const previous = await tx.store.get(op.ref.path);
      if (op.kind === 'update' && previous === undefined) throw new Error('This record no longer exists. Refresh and try again.');
      const data = encodeWorkspaceValue(op.data, previous);
      const result = op.kind === 'update' || op.options?.merge ? merge(previous || {}, data) : data;
      await tx.store.put(result, op.ref.path);
    }
    await tx.done;
    notify();
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}
function merge(previous: any, next: any): any {
  const result = { ...previous };
  for (const [key, value] of Object.entries(next)) {
    if (key.includes('.')) {
      const parts = key.split('.'); let target = result;
      for (const part of parts.slice(0, -1)) target = target[part] = { ...(target[part] || {}) };
      target[parts.at(-1)!] = value;
    } else result[key] = value && typeof value === 'object' && !Array.isArray(value) && !(value as any).__workspaceTimestamp ? merge(previous?.[key] || {}, value) : value;
  }
  return result;
}
// The photo queue uses a single IndexedDB read/write transaction for its read-
// modify-write step, so concurrent uploads cannot overwrite each other's metadata.
export async function runLocalTransaction<T>(_db: any, callback: (transaction: cloud.Transaction) => Promise<T>, uid = LOCAL_USER_ID): Promise<T> {
  const db = uid === LOCAL_USER_ID ? await legacyWorkspaceDatabase() : await workspaceDatabase();
  const tx = db.transaction('documents', 'readwrite');
  const operations: Operation[] = [];
  const transaction: any = {
    async get(ref: any) { if (!local(ref) || namespace(ref) !== uid) throw new Error('Local transactions must belong to one profile.'); return snapshot(ref, await tx.store.get(ref.path)); },
    set(ref: any, data: any, options: any) { operations.push({ kind: 'set', ref, data, options }); return transaction; },
    update(ref: any, data: any) { operations.push({ kind: 'update', ref, data }); return transaction; },
    delete(ref: any) { operations.push({ kind: 'delete', ref }); return transaction; },
  };
  try {
    const result = await callback(transaction);
    for (const op of operations) {
      if (!local(op.ref) || namespace(op.ref) !== uid) throw new Error('Local transactions must belong to one profile.');
      if (op.kind === 'delete') await tx.store.delete(op.ref.path);
      else {
        const previous = await tx.store.get(op.ref.path);
        if (op.kind === 'update' && previous === undefined) throw new Error('The record no longer exists.');
        const data = encodeWorkspaceValue(op.data, previous);
        await tx.store.put(op.kind === 'update' || op.options?.merge ? merge(previous || {}, data) : data, op.ref.path);
      }
    }
    await tx.done; notify(); return result;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); return report(error); }
}
export const setDoc: typeof cloud.setDoc = ((ref: any, data: any, options: any) => (local(ref) ? commit([{ kind: 'set', ref, data, options }]) : options ? cloud.setDoc(ref, sanitizeFirestorePayload(data), options) : cloud.setDoc(ref, sanitizeFirestorePayload(data))).catch(report)) as any;
export const updateDoc: typeof cloud.updateDoc = ((ref: any, data: any) => (local(ref) ? commit([{ kind: 'update', ref, data }]) : cloud.updateDoc(ref, sanitizeFirestorePayload(data))).catch(report)) as any;
export const deleteDoc: typeof cloud.deleteDoc = ((ref: any) => (local(ref) ? commit([{ kind: 'delete', ref }]) : cloud.deleteDoc(ref)).catch(report)) as any;
export const addDoc: typeof cloud.addDoc = (async (ref: any, data: any) => {
  if (!local(ref)) return cloud.addDoc(ref, data);
  const document = cloud.doc(ref); await setDoc(document, data); return document;
}) as any;
function transform(kind: string, fn: any, args: any[]) { const result = fn(...args); fields.set(result, { kind, args }); return result; }
export const serverTimestamp = () => transform('timestamp', cloud.serverTimestamp, []);
export const arrayUnion = (...args: any[]) => transform('union', cloud.arrayUnion, args);
export const arrayRemove = (...args: any[]) => transform('remove', cloud.arrayRemove, args);
export const writeBatch: typeof cloud.writeBatch = ((db: any) => {
  const remote = cloud.writeBatch(db); const operations: Operation[] = [];
  const batch: any = {
    set(ref: any, data: any, options: any) { operations.push({ kind: 'set', ref, data, options }); return batch; },
    update(ref: any, data: any) { operations.push({ kind: 'update', ref, data }); return batch; },
    delete(ref: any) { operations.push({ kind: 'delete', ref }); return batch; },
    async commit() {
      if (operations.every(op => local(op.ref))) return commit(operations);
      if (operations.some(op => local(op.ref))) throw new Error('Cannot mix local and cloud data in a batch.');
      for (const op of operations) {
        if (op.kind === 'delete') remote.delete(op.ref);
        else if (op.kind === 'update') remote.update(op.ref, op.data);
        else if (op.options) remote.set(op.ref, op.data, op.options);
        else remote.set(op.ref, op.data);
      }
      await remote.commit();
    },
  }; return batch;
}) as any;
