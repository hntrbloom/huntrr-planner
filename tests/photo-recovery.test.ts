import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

test('failed photo repair preserves original image references and private attachments', async () => {
  const writes: unknown[] = [];
  const source = { images: [
    { url: 'blob:original-photo', storagePath: 'users/original/missing', caption: 'Keep my caption' },
    { url: 'supabase://aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/private', caption: 'Private photo' },
  ] };
  mock.module('../src/lib/firebase.ts', { namedExports: { db: {}, storage: {} } });
  mock.module('../src/lib/AuthContext.tsx', { namedExports: { getAccessToken: () => null } });
  mock.module('../src/lib/driveAuth.ts', { namedExports: { requestFreshDriveToken: async () => null } });
  mock.module('../src/lib/accountStore.ts', { namedExports: { getAccountOwner: () => 'owner' } });
  mock.module('../src/lib/accountFiles.ts', { namedExports: {
    ACCOUNT_FILE_PREFIX: 'supabase://', readAccountFile: async () => { throw new Error('Offline'); }, uploadAccountFile: async () => '',
  } });
  mock.module('firebase/storage', { namedExports: {
    ref: () => ({}), getDownloadURL: async () => { throw new Error('Offline'); }, uploadBytes: async () => {},
  } });
  mock.module('../src/lib/workspaceStore.ts', { namedExports: {
    collection: (_db: unknown, path: string) => path, doc: () => ({}),
    getDocs: async (path: string) => ({ docs: path.endsWith('/prints') ? [{ id: 'original', data: () => structuredClone(source) }] : [] }),
    getDoc: async () => ({}), setDoc: async () => {}, updateDoc: async (_ref: unknown, data: unknown) => writes.push(data),
  } });
  const { runPhotoMigration } = await import('../src/lib/imageService');
  const report = await runPhotoMigration('owner');
  assert.equal(report.totalScanned, 2);
  assert.equal(report.unrecoverable, 2);
  assert.deepEqual(writes, [], 'unavailable attachments must not rewrite their records');
  assert.ok(report.details.some(line => line.includes('retained')));
});
