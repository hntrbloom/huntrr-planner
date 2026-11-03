import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { LOCAL_USER_ID } from '../src/lib/workspaceMode';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, documentId, arrayUnion, arrayRemove, serverTimestamp, onSnapshot, writeBatch, runLocalTransaction } from '../src/lib/workspaceStore';
import { validatePublicUrl } from '../src/lib/safeRemote';

const db = getFirestore(initializeApp({ projectId: 'isolated-organizer-tests' }));
const records = collection(db, `users/${LOCAL_USER_ID}/test-records`);

test('local create/read/edit/delete persists and preserves nested values', async () => {
  const ref = doc(records, 'crud');
  await setDoc(ref, { name: 'Moon Rabbit', nested: { keep: 1, change: 2 }, zero: 0, no: false });
  await setDoc(ref, { nested: { change: 3 }, empty: [] }, { merge: true });
  assert.deepEqual((await getDoc(ref)).data(), { name: 'Moon Rabbit', nested: { keep: 1, change: 3 }, zero: 0, no: false, empty: [] });
  await updateDoc(ref, { 'nested.keep': 4, name: 'Edited' });
  assert.equal((await getDoc(ref)).data()?.nested.keep, 4);
  await deleteDoc(ref);
  assert.equal((await getDoc(ref)).exists(), false);
  await assert.rejects(updateDoc(ref, { name: 'missing' }), /no longer exists/);
});
test('local queries apply filters, sort, document IDs and limits', async () => {
  for (const [id, score] of [['a', 1], ['b', 3], ['c', 2]] as const) await setDoc(doc(records, id), { score, kind: 'query' });
  const result = await getDocs(query(records, where('kind', '==', 'query'), where('score', '>=', 2), orderBy('score', 'desc'), limit(1)));
  assert.deepEqual(result.docs.map(d => d.id), ['b']);
  assert.deepEqual((await getDocs(query(records, where(documentId(), '==', 'a')))).docs.map(d => d.id), ['a']);
  for (const id of ['a','b','c']) await deleteDoc(doc(records, id));
});
test('timestamps, array transforms, and subscriptions reflect committed writes', async () => {
  const ref = doc(records, 'transforms');
  await setDoc(ref, { tags: ['one'], at: serverTimestamp() });
  assert.equal(typeof (await getDoc(ref)).data()?.at.toDate, 'function');
  await updateDoc(ref, { tags: arrayUnion('one', 'two') });
  assert.deepEqual((await getDoc(ref)).data()?.tags, ['one', 'two']);
  const observed = new Promise<void>((resolve, reject) => {
    const unsubscribe = onSnapshot(ref, snap => { if (snap.data()?.tags.length === 1 && snap.data()?.tags[0] === 'two') { unsubscribe(); resolve(); } }, reject);
  });
  await updateDoc(ref, { tags: arrayRemove('one') });
  await observed; await deleteDoc(ref);
});
test('atomic batches reject mixed local and cloud namespaces', async () => {
  const ref = doc(records, 'atomic');
  const batch = writeBatch(db);
  batch.set(ref, { value: 1 }); batch.set(doc(db, 'users/other-user/test-records/no-write'), { value: 2 });
  await assert.rejects(batch.commit(), /mix local and cloud/);
  assert.equal((await getDoc(ref)).exists(), false);
});
test('concurrent photo transactions preserve all updates', async () => {
  const ref = doc(records, 'photos'); await setDoc(ref, { images: [] });
  await Promise.all([1,2,3].map(id => runLocalTransaction(db, async transaction => {
    const snap = await transaction.get(ref); transaction.update(ref, { images: [...snap.data()!.images, id] });
  })));
  assert.equal((await getDoc(ref)).data()?.images.length, 3); await deleteDoc(ref);
});
test('remote import rejects private, loopback, credentialed and non-HTTP URLs', async () => {
  assert.equal((await validatePublicUrl('https://8.8.8.8')).hostname, '8.8.8.8');
  assert.equal((await validatePublicUrl('https://[2001:4860:4860::8888]')).protocol, 'https:');
  for (const url of ['http://127.0.0.1', 'http://10.2.3.4', 'http://169.254.169.254', 'http://192.168.1.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'file:///etc/passwd', 'https://user:pass@example.com', 'http://8.8.8.8:1234']) await assert.rejects(validatePublicUrl(url));
});


test('backup validation accepts legacy and versioned records and rejects unsafe inputs', async () => {
  const { validateBackup } = await import('../src/lib/backupValidation');
  assert.equal(validateBackup({ preferences: { notesData: { notes: [] } } }).count, 1);
  assert.equal(validateBackup({ format: 'huntrr.organizer', version: 1, data: { preferences: { characterWiki: { characters: [{ name: 'Moon Rabbit', series: 'Garden', company: 'Sanrio' }] } } } }).count, 1);
  for (const invalid of [null, [], { invalidCollection: {} }, { format: 'huntrr.organizer', version: 99, data: {} }, { preferences: { 'invalid/path': {} } }, { _user: 'bad' }, JSON.parse('{"preferences":{"notesData":{"__proto__":{"x":1}}}}')]) assert.throws(() => validateBackup(invalid));
});
