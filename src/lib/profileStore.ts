import { v4 as uuid } from 'uuid';
import { isProfileId } from './workspaceMode';
import { workspaceDatabase } from './workspaceStore';

export interface Profile {
  id: string;
  nickname: string;
  createdAt: string;
}

export interface WorkspaceAttachment {
  kind: 'photo' | 'file';
  blob: Blob;
}

const ACTIVE_PROFILE = 'activeProfile';

export function validateNickname(value: string) {
  const nickname = value.trim();
  if (!nickname || nickname.length > 40) throw new Error('Enter a nickname between 1 and 40 characters.');
  return nickname;
}

export async function readProfiles() {
  const database = await workspaceDatabase();
  const tx = database.transaction(['profiles', 'profileSettings']);
  const [profiles, activeId]: [Profile[], string | undefined] = await Promise.all([
    tx.objectStore('profiles').getAll(),
    tx.objectStore('profileSettings').get(ACTIVE_PROFILE),
  ]);
  await tx.done;
  profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { profiles, active: profiles.find(profile => profile.id === activeId) ?? null };
}

export async function createProfile(
  nickname: string,
  snapshot?: { documents: [string, unknown][]; files: [string, WorkspaceAttachment][] },
) {
  const profile = { id: `huntrr-profile-${uuid()}`, nickname: validateNickname(nickname), createdAt: new Date().toISOString() };
  const database = await workspaceDatabase();
  const tx = database.transaction(['profiles', 'profileSettings', 'documents', 'attachments'], 'readwrite');
  try {
    // add() rejects a duplicate key, and all copied records commit with the profile.
    await tx.objectStore('profiles').add(profile, profile.id);
    for (const [relativePath, value] of snapshot?.documents ?? []) {
      const path = relativePath ? `users/${profile.id}/${relativePath}` : `users/${profile.id}`;
      await tx.objectStore('documents').add(value, path);
    }
    for (const [key, file] of snapshot?.files ?? []) {
      await tx.objectStore('attachments').add(file, `${profile.id}/${key}`);
    }
    await tx.objectStore('profileSettings').put(profile.id, ACTIVE_PROFILE);
    await tx.done;
    return profile;
  } catch (error) {
    try { tx.abort(); } catch {}
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function selectProfile(id: string): Promise<Profile> {
  const database = await workspaceDatabase();
  const tx = database.transaction(['profiles', 'profileSettings', 'documents', 'attachments'], 'readwrite');
  const profile = isProfileId(id) && await tx.objectStore('profiles').get(id);
  if (!profile) throw new Error('This profile is unavailable. Choose another profile.');
  await tx.objectStore('profileSettings').put(id, ACTIVE_PROFILE);
  await tx.done;
  return profile;
}

export async function renameProfile(id: string, value: string): Promise<Profile> {
  const nickname = validateNickname(value);
  const database = await workspaceDatabase();
  const tx = database.transaction('profiles', 'readwrite');
  const profile = isProfileId(id) && await tx.store.get(id);
  if (!profile) throw new Error('This profile is unavailable.');
  const updated = { ...profile, nickname };
  await tx.store.put(updated, id);
  await tx.done;
  return updated;
}
