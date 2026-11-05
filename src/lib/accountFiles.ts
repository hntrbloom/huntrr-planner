import { getAccountOwner, queueAccountFile, readQueuedAccountFile } from './accountStore';
import { supabase } from './supabase';

export const ACCOUNT_FILE_PREFIX = 'supabase://';
export const ACCOUNT_BUCKET = 'planner-files';

function bucket(owner: string) {
  if (!supabase || getAccountOwner() !== owner) throw new Error('Sign in to the account that owns this file.');
  return supabase.storage.from(ACCOUNT_BUCKET);
}
function ownedPath(reference: string) {
  const path = reference.slice(ACCOUNT_FILE_PREFIX.length);
  if (!reference.startsWith(ACCOUNT_FILE_PREFIX) || !/^[0-9a-f-]+\/[0-9a-f-]+$/i.test(path)) {
    throw new Error('Invalid planner attachment.');
  }
  return { path, owner: path.split('/')[0] };
}

async function digest(blob: Blob) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sendAccountFile(owner: string, path: string, blob: Blob) {
  const { error } = await bucket(owner).upload(path, blob, { upsert: false, contentType: blob.type || 'application/octet-stream' });
  if (error) {
    const existing = await bucket(owner).download(path);
    if (existing.error) throw error;
    if (await digest(existing.data) !== await digest(blob)) throw new Error('The existing cloud attachment could not be verified.');
  }
}

export async function uploadAccountFile(owner: string, blob: Blob, deduplicate = false) {
  const key = deduplicate ? await digest(blob) : crypto.randomUUID();
  const path = owner + '/' + key;
  if (deduplicate) await sendAccountFile(owner, path, blob);
  else await queueAccountFile(owner, path, blob);
  return ACCOUNT_FILE_PREFIX + path;
}

export async function readAccountFile(reference: string) {
  const { path, owner } = ownedPath(reference);
  const queued = await readQueuedAccountFile(owner, path);
  if (queued) return queued;
  const { data, error } = await bucket(owner).download(path);
  if (error) throw error;
  if (getAccountOwner() !== owner) throw new Error('The active account changed.');
  return data;
}
