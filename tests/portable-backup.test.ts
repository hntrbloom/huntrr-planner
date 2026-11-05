import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

test('portable legacy export includes IndexedDB fallback files without changing original references', async () => {
  const original = { format: 'huntrr.organizer', version: 1, data: { photos: { old: { url: 'idb://photo_original' } } }, files: {} };
  let source = structuredClone(original);
  mock.module('../src/lib/backup.ts', { namedExports: {
    gatherAllData: async (owner: string, legacy: boolean) => {
      assert.equal(owner, 'legacy-owner'); assert.equal(legacy, true); return structuredClone(source);
    },
  } });
  class TestFileReader {
    result = '';
    onload?: () => void;
    onerror?: () => void;
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onload?.();
      });
    }
  }
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: TestFileReader });
  const { savePhotoToIDB, getPhotoFromIDB } = await import('../src/lib/idb');
  await savePhotoToIDB('photo_original', new Blob(['original-image-bytes'], { type: 'image/png' }));
  const { portableBackup } = await import('../src/lib/accountMigration');
  const backup = await portableBackup('legacy-owner', true);
  assert.equal(backup.data.photos.old.url, 'idb://photo_original');
  assert.equal(backup.files.photo_original.dataUrl, 'data:image/png;base64,' + Buffer.from('original-image-bytes').toString('base64'));
  assert.equal(await (await getPhotoFromIDB('photo_original'))?.text(), 'original-image-bytes');
  assert.deepEqual(source, original);
  source.data.photos.old.url = 'idb://photo_missing';
  await assert.rejects(portableBackup('legacy-owner', true), /missing/i);
  source.data.photos.old.url = 'blob:expired-reference';
  await assert.rejects(portableBackup('legacy-owner', true), /temporary attachment/i);
});
