export const BACKUP_COLLECTIONS = ['settings', 'preferences', 'appointments', 'workShifts', 'dailyLogs', 'boards', 'photos', 'notes', 'goals', 'keychains', 'miniFurniture', 'minifurniture', 'prints', 'printing', 'saved_models', 'reminders', 'blog', 'jobs', 'job_applications', 'activity', 'moods', 'medications'] as const;

export function validateBackup(backup: any) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) throw new Error('Choose a valid JSON backup.');
  const data = backup.format === 'huntrr.organizer' ? backup.data : backup;
  if (backup.format && (backup.format !== 'huntrr.organizer' || ![1, 2].includes(backup.version))) throw new Error('This backup format is not supported.');
  if (!data || typeof data !== 'object' || Array.isArray(data) || (!Object.keys(data).length && backup.version !== 2)) throw new Error('This backup has no records.');
  const inspect = (value: any): void => {
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('The backup contains an unsafe field.');
      inspect(child);
    }
  };
  inspect(backup);
  let count = 0;
  for (const [name, records] of Object.entries(data)) {
    if (name === '_user') { if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid legacy user record.'); continue; }
    if (!BACKUP_COLLECTIONS.includes(name as any) || !records || typeof records !== 'object' || Array.isArray(records)) throw new Error(`Invalid backup collection: ${name}`);
    for (const [id, value] of Object.entries(records)) {
      if (!id || id.includes('/') || ['__proto__', 'constructor', 'prototype'].includes(id) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The backup contains an invalid record.');
      count++;
    }
  }
  if (backup.files != null && (typeof backup.files !== 'object' || Array.isArray(backup.files))) throw new Error('Invalid backup attachment table.');
  for (const [key, file] of Object.entries<any>(backup.files || {})) {
    if (!/^(photo_|huntrr_local_stl_)[a-zA-Z0-9_.-]+$/.test(key) || !file || !['photo', 'file'].includes(file.kind) || typeof file.dataUrl !== 'string' || !/^data:[^,]*;base64,/.test(file.dataUrl)) throw new Error('The backup contains an invalid local attachment.');
  }
  return { data, count };
}
