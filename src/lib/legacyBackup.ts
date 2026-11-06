import { app, db } from './firebase';
import { LOCAL_USER_ID } from './workspaceMode';
import { gatherAllData, newBackup, legacyAttachments, type WorkspaceBackup } from './backup';
import { legacyWorkspaceDatabase } from './workspaceStore';
import { documentRange } from './workspaceMode';

const olderBrowserKeys = [
  'guest_appointments', 'habitsData', 'characterWikiData', 'serene_boards', 'serene_photos',
  'guest_medication_logs', 'guest_job_applications', 'guest_local_companies', 'guest_remote_companies',
  'job_sync_meta', 'job_autocomplete_history', 'job_weekly_goal', 'huntrr_saved_models_guest',
  'focus_timer_state', 'huntrr_print_folder_ids', 'huntrr_wiki_folder_id', 'huntrr_models_folder_id',
  `huntrr_receipts_${LOCAL_USER_ID}`,
];

export async function findBrowserWorkspaces() {
  const db = await legacyWorkspaceDatabase();
  return {
    local: (await db.count('documents', documentRange(LOCAL_USER_ID))) > 0,
    browser: olderBrowserKeys.some(key => localStorage.getItem(key) !== null),
  };
}

export async function exportOlderBrowserData(): Promise<WorkspaceBackup> {
  const raw: Record<string, string> = {};
  for (const key of olderBrowserKeys) {
    const value = localStorage.getItem(key);
    if (value !== null) raw[key] = value;
  }
  const read = (key: string) => {
    if (!(key in raw)) return undefined;
    try { return JSON.parse(raw[key]); } catch { return raw[key]; }
  };
  const records = (key: string) => Object.fromEntries(
    (Array.isArray(read(key)) ? read(key) : []).map((value: any, index: number) => [
      typeof value?.id === 'string' && /^[a-zA-Z0-9_.-]+$/.test(value.id) && !['__proto__', 'constructor', 'prototype'].includes(value.id)
        ? value.id : `legacy-${index}`,
      value,
    ]).filter(([, value]: [string, unknown]) => value && typeof value === 'object' && !Array.isArray(value)),
  );
  const preferences: Record<string, unknown> = { olderBrowserRecords: { raw } };
  const wiki = read('characterWikiData');
  if (wiki && typeof wiki === 'object') preferences.characterWiki = Array.isArray(wiki) ? { characters: wiki } : wiki;
  const habits = read('habitsData');
  if (habits && typeof habits === 'object') preferences.habitsData = Array.isArray(habits) ? { habits } : habits;
  const timer = read('focus_timer_state');
  if (timer && typeof timer === 'object') preferences.focusTimer = timer;
  const receipts = read(`huntrr_receipts_${LOCAL_USER_ID}`);
  if (Array.isArray(receipts)) preferences.clientReceiptsData = { receipts };
  if (raw.guest_job_applications || raw.guest_local_companies || raw.guest_remote_companies) {
    preferences.jobApplicationsData = {
      applications: read('guest_job_applications') || [],
      localCompanies: read('guest_local_companies') || [],
      remoteCompanies: read('guest_remote_companies') || [],
      syncMeta: read('job_sync_meta'),
    };
  }
  if (raw.job_autocomplete_history) preferences.jobAutocompleteHistory = read('job_autocomplete_history');
  if (raw.job_weekly_goal && Number.isFinite(Number(raw.job_weekly_goal))) preferences.jobStreakConfig = { weeklyGoal: Number(raw.job_weekly_goal) };
  const data = {
    preferences,
    settings: { general: {
      printFolderIds: read('huntrr_print_folder_ids') || {},
      driveFolders: { wikiFolderId: read('huntrr_wiki_folder_id'), modelsFolderId: read('huntrr_models_folder_id') },
    } },
    appointments: records('guest_appointments'),
    boards: records('serene_boards'),
    photos: records('serene_photos'),
    medications: records('guest_medication_logs'),
    saved_models: records('huntrr_saved_models_guest'),
  };
  return newBackup(data, await legacyAttachments(data));
}

export async function exportExistingFirebaseWorkspace() {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth(app);
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('There is no existing Firebase session on this site. Export Everything from the old Organizer in the browser where your workspace opens, then import that file here.');
  return gatherAllData(user.uid, db);
}
