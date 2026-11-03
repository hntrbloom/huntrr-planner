import { db } from './firebase';
import { collection, doc, getDoc, getDocs, writeBatch, Timestamp } from './workspaceStore';
import { getFileFromIDB, getPhotoFromIDB, saveFileToIDB, savePhotoToIDB } from './idb';
import { LOCAL_USER_ID } from './workspaceMode';

import { BACKUP_COLLECTIONS, validateBackup } from './backupValidation';
export { validateBackup } from './backupValidation';
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
export async function gatherAllData(userId: string) {
  const data: Record<string, any> = {};
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, `users/${userId}/${name}`));
    data[name] = Object.fromEntries(snap.docs.map(d => [d.id, encode(d.data())]));
  }
  const root = await getDoc(doc(db, 'users', userId));
  if (root.exists()) data._user = encode(root.data());
  const files: Record<string, { kind: 'photo' | 'file'; dataUrl: string }> = {};
  if (userId === LOCAL_USER_ID) {
    const visit = async (value: any) => {
      if (typeof value === 'string' && (value.startsWith('idb://') || value.startsWith('huntrr_local_stl_'))) {
        const key = value.replace('idb://', '');
        if (files[key]) return;
        const kind = value.startsWith('idb://') ? 'photo' : 'file';
        const blob = kind === 'photo' ? await getPhotoFromIDB(key) : await getFileFromIDB(key);
        if (!blob) throw new Error(`A local attachment is missing (${key}). Restore or remove its record before exporting.`);
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
        files[key] = { kind, dataUrl };
      } else if (value && typeof value === 'object') for (const child of Object.values(value)) await visit(child);
    };
    await visit(data);
  }
  return { format: 'huntrr.organizer', version: 1, exportedAt: new Date().toISOString(), storage: userId === LOCAL_USER_ID ? 'local' : 'firebase', data, files };
}
export async function restoreData(userId: string, backup: any) {
  const { data } = validateBackup(backup);
  if (Object.keys(backup.files || {}).length && userId !== LOCAL_USER_ID) throw new Error('Restore this local backup into the local workspace so its attachments stay available.');
  for (const [key, file] of Object.entries<any>(backup.files || {})) {
    const blob = await (await fetch(file.dataUrl)).blob();
    if (file.kind === 'photo') await savePhotoToIDB(key, blob); else await saveFileToIDB(key, blob);
  }
  let batch = writeBatch(db); let size = 0;
  for (const [name, records] of Object.entries<any>(data)) {
    if (name === '_user') { batch.set(doc(db, 'users', userId), decode(records), { merge: true }); size++; }
    else for (const [id, value] of Object.entries(records)) {
      batch.set(doc(db, `users/${userId}/${name}`, id), decode(value), { merge: true }); size++;
      if (size >= 400) { await batch.commit(); batch = writeBatch(db); size = 0; }
    }
  }
  if (size) await batch.commit();
}
