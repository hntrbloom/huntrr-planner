import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

test('import verifies new records, is repeatable, and preserves a conflicting account copy', async () => {
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const rows = new Map<string, unknown>([['preferences/notesData', { notes: [{ id: 'cloud' }] }]]);
  const query = {
    select: () => query,
    eq: (_field: string, value: string) => { assert.equal(value, owner); return query; },
    in: async (_field: string, paths: string[]) => ({
      data: paths.filter(path => rows.has(path)).map(path => ({ path, data: structuredClone(rows.get(path)) })),
      error: null,
    }),
  };
  const channel = { on: () => channel, subscribe: () => channel };
  mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
    from: () => query,
    channel: () => channel,
    removeChannel: async () => {},
    rpc: async (_name: string, input: { p_owner: string; p_changes: Array<{ path: string; expected: number; data: unknown }> }) => {
      assert.equal(input.p_owner, owner);
      for (const record of input.p_changes) {
        assert.equal(record.expected, 0);
        assert.equal(rows.has(record.path), false);
        rows.set(record.path, structuredClone(record.data));
      }
      return { error: null };
    },
  } } });
  const { setAccountOwner } = await import('../src/lib/accountStore');
  const { importIntoAccount } = await import('../src/lib/accountMigration');
  const backup = {
    format: 'huntrr.organizer', version: 1,
    data: {
      preferences: { notesData: { notes: [{ id: 'local' }] } },
      appointments: { planning: { name: 'Planning', date: '2026-11-05' } },
    },
  };
  const original = structuredClone(backup);
  try {
    setAccountOwner(owner);
    assert.deepEqual(await importIntoAccount(owner, backup), { imported: 1, alreadyPresent: 0, skipped: 1 });
    assert.deepEqual(await importIntoAccount(owner, backup), { imported: 0, alreadyPresent: 1, skipped: 1 });
    assert.deepEqual(rows.get('preferences/notesData'), { notes: [{ id: 'cloud' }] });
    assert.deepEqual(rows.get('appointments/planning'), original.data.appointments.planning);
    assert.deepEqual(backup, original);
    await assert.rejects(importIntoAccount(crypto.randomUUID(), backup), /destination account/i);
  } finally { setAccountOwner(null); }
});
