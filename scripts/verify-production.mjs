import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const response = await fetch(`${base}/api/health`);
assert.equal(response.status, 200);
assert.equal((await response.json()).product, 'huntrr.organizer');
const frontend = await fetch(base);
assert.equal(frontend.status, 200);
const html = await frontend.text();
assert.match(html, /huntrr.organizer/);
assert.doesNotMatch(html, /@vite\/client|\/src\/main.tsx/);
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1]);
assert.ok(assets.length >= 2);
for (const asset of [...assets, '/favicon.svg']) {
  const result = await fetch(base + asset); assert.equal(result.status, 200, asset);
  assert.doesNotMatch(result.headers.get('content-type'), /text\/html/, asset);
}
const missing = await fetch(`${base}/api/unknown-route`);
assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type'), /application\/json/);
assert.equal((await fetch(`${base}/organizer/deep-link`)).status, 200);
const post = (route, body) => fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
assert.equal((await post('extract-job-url', {})).status, 400);
const privateImport = await (await post('extract-job-url', { url: 'http://127.0.0.1/private' })).json();
assert.equal(privateImport.success, false);
const ai = await post('extract-job-text', { text: 'Test-only job description, no external calls.' });
assert.ok([401,503].includes(ai.status), 'AI must require configuration and real sign-in');
assert.equal((await post('pinterest/process', { url: 'https://example.com/board' })).status, 400);
assert.equal((await fetch(`${base}/api/makerworld-preview?url=https://example.com`)).status, 400);
assert.equal((await post('drive/restore', {})).status, 400);
assert.equal((await post('sheets/fetch', {})).status, 400);
const invalid = await fetch(`${base}/api/extract-job-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
assert.equal(invalid.status, 400); assert.match(invalid.headers.get('content-type'), /application\/json/);
console.log(`PASS: production frontend, ${assets.length} entry assets, favicon, deep links, health, API JSON 404, validation, private-URL rejection, AI configuration/auth and malformed JSON at ${base}`);
