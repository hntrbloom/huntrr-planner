import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const alice = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bob = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const schema = await readFile(new URL('../supabase/migrations/202611040001_planner_accounts.sql', import.meta.url), 'utf8');

test('planner migration enforces ownership, atomic writes, replay safety, and deletion', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema storage;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table storage.objects (bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$ select parts[1:cardinality(parts)-1] from (select string_to_array(name, '/') parts) parsed $$;
      grant usage on schema auth, storage to authenticated, anon;
      grant select, insert, delete on storage.objects to authenticated;
      create publication supabase_realtime;
    `);
    await db.exec(schema);
    await db.query('insert into auth.users values ($1), ($2)', [alice, bob]);
    const path = 'preferences/notesData';
    const apply = (actor: string, owner: string, request: string, changes: unknown[]) =>
      db.transaction(async tx => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [actor]);
        return tx.query('select public.planner_apply($1, $2, $3::jsonb)', [owner, request, JSON.stringify(changes)]);
      });
    const create = [{ path, expected: 0, data: { notes: [{ id: 'one' }] } }];
    const first = crypto.randomUUID();
    await apply(alice, alice, first, create);
    await apply(alice, alice, first, create);
    await assert.rejects(apply(bob, alice, crypto.randomUUID(), create), /access denied/i);
    await assert.rejects(db.transaction(async tx => {
      await tx.exec('set local role anon');
      return tx.query('select * from public.planner_documents');
    }), /permission denied/i);
    const bobRows = await db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [bob]);
      return tx.query('select * from public.planner_documents');
    });
    assert.equal(bobRows.rows.length, 0);
    await assert.rejects(apply(alice, alice, crypto.randomUUID(), [
      { path: 'preferences/other', expected: 0, data: { a: 1 } }, ...create,
    ]), /newer copy/i);
    const beforeDelete = await db.query<{ version: number }>('select version from public.planner_documents');
    assert.deepEqual(beforeDelete.rows, [{ version: 1 }]);
    await apply(alice, alice, crypto.randomUUID(), [{ path, expected: 1, data: null }]);
    await assert.rejects(apply(alice, alice, crypto.randomUUID(), create), /newer copy/i);
    await db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [alice]);
      await tx.query("insert into storage.objects values ('planner-files', $1)", [alice + '/own']);
    });
    await assert.rejects(db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [bob]);
      await tx.query("insert into storage.objects values ('planner-files', $1)", [alice + '/intrusion']);
    }), /row-level security/i);
    const bobFiles = await db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [bob]);
      return tx.query('select * from storage.objects');
    });
    assert.equal(bobFiles.rows.length, 0);
    await db.query('delete from auth.users where id = $1', [alice]);
    assert.equal((await db.query('select * from public.planner_documents')).rows.length, 0);
    assert.equal((await db.query('select * from public.planner_write_receipts')).rows.length, 0);
  } finally { await db.close(); }
});
