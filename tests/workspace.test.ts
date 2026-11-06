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

test('profile selection and renaming persist with independent record and file namespaces', async () => {
  const { createProfile, readProfiles, renameProfile, selectProfile } = await import('../src/lib/profileStore');
  const { savePhotoToIDB, getPhotoFromIDB, saveFileToIDB, getFileFromIDB } = await import('../src/lib/idb');
  const one = await createProfile('  Pink planner  ');
  const two = await createProfile('Pink planner');
  assert.notEqual(one.id, two.id);
  assert.equal(one.nickname, 'Pink planner');
  const note = (id: string) => doc(db, `users/${id}/preferences/notesData`);
  await setDoc(note(one.id), { notes: [{ title: 'Profile one' }] });
  await setDoc(note(two.id), { notes: [{ title: 'Profile two' }] });
  await savePhotoToIDB('photo_shared', new Blob(['photo-one'], { type: 'image/png' }), one.id);
  await savePhotoToIDB('photo_shared', new Blob(['photo-two'], { type: 'image/png' }), two.id);
  await saveFileToIDB('huntrr_local_stl_shared', new Blob(['stl-one'], { type: 'model/stl' }), one.id);
  assert.equal(await getFileFromIDB('huntrr_local_stl_shared', two.id), undefined);
  const renamed = await renameProfile(one.id, 'Cherry');
  assert.equal(renamed.id, one.id);
  assert.equal(renamed.createdAt, one.createdAt);
  await selectProfile(one.id);
  assert.equal((await readProfiles()).active?.nickname, 'Cherry');
  assert.equal((await getDoc(note(one.id))).data()?.notes[0].title, 'Profile one');
  assert.equal((await getDoc(note(two.id))).data()?.notes[0].title, 'Profile two');
  assert.equal(await (await getPhotoFromIDB('photo_shared', one.id))?.text(), 'photo-one');
  assert.equal(await (await getPhotoFromIDB('photo_shared', two.id))?.text(), 'photo-two');
  const batch = writeBatch(db);
  batch.set(note(one.id), { notes: [] });
  batch.set(note(two.id), { notes: [] });
  await assert.rejects(batch.commit(), /one profile/);
  assert.equal((await getDoc(note(two.id))).data()?.notes[0].title, 'Profile two');
});

test('migration copies legacy records, photos and STLs without changing the original namespace', async () => {
  const { gatherAllData, importProfileBackup } = await import('../src/lib/backup');
  const { savePhotoToIDB, getPhotoFromIDB, saveFileToIDB, getFileFromIDB } = await import('../src/lib/idb');
  const legacyWiki = doc(db, `users/${LOCAL_USER_ID}/preferences/characterWiki`);
  const legacyModel = doc(db, `users/${LOCAL_USER_ID}/saved_models/legacy-model`);
  await setDoc(legacyWiki, { characters: [{ name: 'Moon Rabbit', series: 'Garden', company: 'Sanrio', imageStoragePath: 'idb://photo_moon' }] });
  await setDoc(legacyModel, { localFileKey: 'huntrr_local_stl_moon', name: 'Moon' });
  await savePhotoToIDB('photo_moon', new Blob(['photo-bytes'], { type: 'image/png' }));
  await saveFileToIDB('huntrr_local_stl_moon', new Blob(['stl-bytes'], { type: 'model/stl' }));
  const backup = await gatherAllData(LOCAL_USER_ID);
  const imported = await importProfileBackup('Legacy copy', backup);
  const duplicate = await importProfileBackup('Another copy', backup);
  assert.notEqual(imported.id, duplicate.id);
  const importedWiki = doc(db, `users/${imported.id}/preferences/characterWiki`);
  const duplicateWiki = doc(db, `users/${duplicate.id}/preferences/characterWiki`);
  assert.deepEqual((await getDoc(importedWiki)).data(), (await getDoc(legacyWiki)).data());
  await setDoc(importedWiki, { characters: [] });
  assert.equal((await getDoc(legacyWiki)).data()?.characters[0].series, 'Garden');
  assert.equal((await getDoc(duplicateWiki)).data()?.characters[0].company, 'Sanrio');
  assert.equal(await (await getPhotoFromIDB('photo_moon', imported.id))?.text(), 'photo-bytes');
  assert.equal(await (await getFileFromIDB('huntrr_local_stl_moon', duplicate.id))?.text(), 'stl-bytes');
  const exportedAgain = await gatherAllData(duplicate.id);
  assert.equal(exportedAgain.files.photo_moon.dataUrl, backup.files.photo_moon.dataUrl);
  assert.equal(exportedAgain.profile?.nickname, 'Another copy');
});

test('a failed copy leaves the current profile and all previously saved data intact', async () => {
  const { createProfile, readProfiles } = await import('../src/lib/profileStore');
  const { importProfileBackup } = await import('../src/lib/backup');
  const before = await readProfiles();
  await assert.rejects(importProfileBackup('Broken backup', {
    format: 'huntrr.organizer', version: 1,
    data: { saved_models: { one: { localFileKey: 'huntrr_local_stl_missing' } } },
  }), /missing a saved attachment/);
  await assert.rejects(createProfile('Conflicting copy', {
    documents: [['preferences/notesData', { notes: [] }], ['preferences/notesData', { notes: ['duplicate'] }]],
    files: [],
  }));
  assert.deepEqual(await readProfiles(), before);
});

test('Supabase export bundles an existing owner’s photos and models without changing the source', async () => {
  const { bundleSupabaseWorkspace } = await import('../src/lib/supabaseBackup');
  const { importProfileBackup } = await import('../src/lib/backup');
  const { getPhotoFromIDB, getFileFromIDB } = await import('../src/lib/idb');
  const owner = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const photo = owner + '/1111';
  const model = owner + '/2222';
  const rows = [
    { path: 'photos/picture', data: { url: 'supabase://' + photo, storagePath: 'supabase://' + photo } },
    { path: 'saved_models/model', data: { localFileKey: 'supabase://' + model, name: 'STL model' } },
  ];
  const original = structuredClone(rows);
  const reads: string[] = [];
  const exported = await bundleSupabaseWorkspace(owner, rows, async path => {
    reads.push(path);
    return new Blob([path === photo ? 'original photo' : 'original model']);
  });
  assert.deepEqual(rows, original);
  assert.deepEqual(reads, [photo, model]);
  assert.equal(exported.storage, 'supabase');
  const profile = await importProfileBackup('Previous email workspace', exported);
  const photoDoc = (await getDoc(doc(db, `users/${profile.id}/photos/picture`))).data()!;
  const modelDoc = (await getDoc(doc(db, `users/${profile.id}/saved_models/model`))).data()!;
  assert.equal(await (await getPhotoFromIDB(photoDoc.url.slice(6), profile.id))?.text(), 'original photo');
  assert.equal(await (await getFileFromIDB(modelDoc.localFileKey, profile.id))?.text(), 'original model');
  await assert.rejects(bundleSupabaseWorkspace('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', rows, async () => {
    assert.fail('Foreign account bytes must never be read.');
  }), /different account/);
});
