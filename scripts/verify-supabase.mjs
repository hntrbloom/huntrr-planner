import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key, SUPABASE_SECRET_KEY: secret } = process.env;
assert.ok(url && key && secret, 'Set the two public Supabase values and the server-only SUPABASE_SECRET_KEY in .env.local.');

const app = new URL(process.argv[2] || 'http://localhost:3000/');
assert.ok(['localhost', '127.0.0.1'].includes(app.hostname), 'Run this test against a local planner instance.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const schema = await admin.from('planner_documents').select('path').limit(0);
assert.ifError(schema.error);

const windowsChrome = process.env.ProgramFiles + '/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (existsSync(windowsChrome) ? windowsChrome : undefined),
});
const created = [];
const marker = 'Planner verification ' + crypto.randomUUID();
const notePath = 'preferences/notesData';

async function testAccount() {
  const email = 'planner-verification-' + crypto.randomUUID() + '@example.com';
  const password = crypto.randomUUID();
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(result.error);
  const { id } = result.data.user;
  created.push(id);
  const client = createClient(url, key, options);
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  return { id, email, password, client };
}

async function logIn(account) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.goto(app.href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.email-account-card input[type=email]');
  await page.type('input[type=email]', account.email);
  await page.type('input[type=password]', account.password);
  await page.click('.email-account-primary');
  await page.waitForSelector('.planner-welcome');
  return page;
}

async function cloudNote(account, content) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const result = await account.client.from('planner_documents')
      .select('data').eq('owner', account.id).eq('path', notePath).maybeSingle();
    assert.ifError(result.error);
    if (result.data?.data?.notes?.some(note => note.content === content)) return;
    await delay(250);
  }
  assert.fail('The notebook edit did not reach Supabase.');
}

try {
  const alice = await testAccount();
  const bob = await testAccount();
  const primary = await logIn(alice);
  await primary.click('[aria-label="Open notebook"]');
  await primary.waitForSelector('[aria-label="Add note"]', { visible: true });
  await primary.click('[aria-label="Add note"]');
  await primary.waitForSelector('[aria-label="Note content"]');
  await primary.type('[aria-label="Note content"]', marker);
  await cloudNote(alice, marker);
  console.log('PASS authenticated notebook edit saved automatically to Supabase.');

  const unauthorized = await bob.client.from('planner_documents').select('data').eq('owner', alice.id).eq('path', notePath);
  assert.ifError(unauthorized.error);
  assert.deepEqual(unauthorized.data, []);
  const forbidden = await bob.client.rpc('planner_apply', {
    p_owner: alice.id, p_request: crypto.randomUUID(), p_changes: [{ path: notePath, expected: 1, data: null }],
  });
  assert.equal(forbidden.error?.code, '42501');
  const anonymous = createClient(url, key, options);
  const publicRead = await anonymous.from('planner_documents').select('data').eq('owner', alice.id).eq('path', notePath);
  assert.ok(publicRead.error || publicRead.data?.length === 0);
  await cloudNote(alice, marker);
  console.log('PASS another account cannot read or write this notebook, and anonymous reads reveal no record.');

  await primary.reload({ waitUntil: 'domcontentloaded' });
  await primary.waitForFunction(text => document.querySelector('[aria-label="Note content"]')?.value === text, {}, marker);
  const secondary = await logIn(alice);
  await secondary.click('[aria-label="Open notebook"]');
  await secondary.waitForFunction(text => document.querySelector('[aria-label="Note content"]')?.value === text, {}, marker);
  await primary.type('[aria-label="Note content"]', ' synced');
  await cloudNote(alice, marker + ' synced');
  await secondary.waitForFunction(text => document.querySelector('[aria-label="Note content"]')?.value === text, {}, marker + ' synced');
  console.log('PASS session restore, a second browser profile, and a live update between profiles.');

  await primary.click('[aria-label="Open settings"]');
  const logout = await primary.waitForFunction(() => [...document.querySelectorAll('.account-settings button')]
    .find(button => button.textContent.trim() === 'Log out'));
  await logout.asElement().click();
  await primary.waitForSelector('.email-account-card input[type=email]');
  await primary.reload({ waitUntil: 'domcontentloaded' });
  await primary.waitForSelector('.email-account-card input[type=email]');
  console.log('PASS logout persists after reload.');
} finally {
  try {
    await browser.close();
  } finally {
    const cleanup = await Promise.all(created.map(id => admin.auth.admin.deleteUser(id)));
    if (cleanup.some(result => result.error)) throw new Error('Could not clean up all generated planner-verification test users.');
  }
}
