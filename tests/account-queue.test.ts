import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

test('offline edits survive a session change, coalesce, retry, and protect newer cloud data', async () => {
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const path = 'preferences/notesData';
  type Row = { owner: string; path: string; version: number; data: Record<string, unknown> };
  let remote: Row | undefined;
  let connected = true;
  let loseResponse = false;
  let writes = 0;
  const uploaded = new Map<string, Blob>();
  const receipts = new Set<string>();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => connected });
  const channel = { on: () => channel, subscribe: () => channel };
  const query = {
    select: () => query, eq: () => query, order: () => query,
    range: async () => ({ data: remote ? [remote] : [], error: null }),
  };
  mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
    from: () => query,
    channel: () => channel,
    removeChannel: async () => {},
    storage: { from: () => ({
      upload: async (key: string, blob: Blob) => { uploaded.set(key, blob); return { error: null }; },
    }) },
    rpc: async (_name: string, input: { p_owner: string; p_request: string; p_changes: Array<{ expected: number; data: Row['data'] }> }) => {
      if (receipts.has(input.p_request)) return { error: null };
      const change = input.p_changes[0];
      if ((remote?.version ?? 0) !== change.expected) return { error: { code: '40001' } };
      remote = { owner: input.p_owner, path, version: change.expected + 1, data: change.data };
      writes++;
      receipts.add(input.p_request);
      if (loseResponse) return { error: { code: 'NETWORK' } };
      return { error: null };
    },
  } } });
  const store = await import('../src/lib/accountStore');
  try {
    store.setAccountOwner(owner);
    await store.readAccountScope(owner, { path, collection: false });
    connected = false;
    const file = owner + '/attachment';
    await store.queueAccountFile(owner, file, new Blob(['photo'], { type: 'image/png' }));
    await store.editAccountDocuments(owner, [{ path, apply: () => ({ title: 'a' }) }]);
    await store.editAccountDocuments(owner, [{ path, apply: () => ({ title: 'ab' }) }]);
    assert.equal(store.getAccountSyncState(), 'Offline');
    assert.equal((await store.getPendingAccountWrites(owner)).length, 1);
    store.setAccountOwner(null);
    await assert.rejects(store.getPendingAccountWrites(owner), /owns this workspace/i);
    store.setAccountOwner(owner);
    assert.equal((await store.readAccountScope(owner, { path, collection: false }))[0].data?.title, 'ab');
    assert.equal(await (await store.readQueuedAccountFile(owner, file))?.text(), 'photo');
    connected = true;
    loseResponse = true;
    await store.syncAccountNow();
    assert.equal(store.getAccountSyncState(), 'Sync failed');
    loseResponse = false;
    await store.syncAccountNow();
    assert.equal(writes, 1);
    assert.equal(store.getAccountSyncState(), 'Saved');
    assert.equal(await uploaded.get(file)?.text(), 'photo');
    assert.equal(await store.readQueuedAccountFile(owner, file), undefined);
    assert.equal((await store.getPendingAccountWrites(owner)).length, 0);
    connected = false;
    await store.editAccountDocuments(owner, [{ path, apply: () => ({ title: 'device edit' }) }]);
    remote = { owner, path, version: 2, data: { title: 'newer cloud edit' } };
    connected = true;
    await store.syncAccountNow();
    assert.equal(store.getAccountSyncState(), 'Conflict');
    assert.equal(remote.data.title, 'newer cloud edit');
    assert.equal((await store.getPendingAccountWrites(owner))[0].changes[0].data?.title, 'device edit');
  } finally { store.setAccountOwner(null); }
});
