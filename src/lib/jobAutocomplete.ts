import { JobApplication } from '../components/JobApplicationsView';

export type AutocompleteFieldType = 'location' | 'workplaceType' | 'employmentType';

export interface AutocompleteItem {
  value: string;         // Preserved original display string, e.g. "San Francisco, CA"
  normalized: string;    // Lowercase trimmed string for duplicate detection, e.g. "san francisco, ca"
  count: number;         // Usage frequency count
  lastUsedAt: string;    // ISO timestamp
  isDefault?: boolean;   // Standard system default
}

export interface JobAutocompleteHistory {
  location: AutocompleteItem[];
  workplaceType: AutocompleteItem[];
  employmentType: AutocompleteItem[];
  deletedValues?: {
    location?: string[];
    workplaceType?: string[];
    employmentType?: string[];
  };
  updatedAt?: string;
}

export const DEFAULT_WORKPLACE_TYPES: string[] = [
  'On-site',
  'Hybrid',
  'Remote'
];

export const DEFAULT_EMPLOYMENT_TYPES: string[] = [
  'Full-time',
  'Part-time',
  'Contract',
  'Temporary',
  'Internship'
];

/**
 * Normalize string by trimming leading/trailing spaces, collapsing internal whitespace,
 * and converting to lower case to eliminate duplicate variations.
 * Example: "  Des   Moines,  IA  " -> "des moines, ia"
 */
export function normalizeValue(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Creates the initial default history populated with standard Workplace and Employment types.
 */
export function createInitialHistory(): JobAutocompleteHistory {
  const now = new Date().toISOString();

  return {
    location: [],
    workplaceType: DEFAULT_WORKPLACE_TYPES.map(val => ({
      value: val,
      normalized: normalizeValue(val),
      count: 1,
      lastUsedAt: now,
      isDefault: true
    })),
    employmentType: DEFAULT_EMPLOYMENT_TYPES.map(val => ({
      value: val,
      normalized: normalizeValue(val),
      count: 1,
      lastUsedAt: now,
      isDefault: true
    })),
    deletedValues: {
      location: [],
      workplaceType: [],
      employmentType: []
    },
    updatedAt: now
  };
}

/**
 * Sorts suggestions by most frequently used (count desc), then most recently used (lastUsedAt desc).
 */
export function sortSuggestions(items: AutocompleteItem[]): AutocompleteItem[] {
  return [...items].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a.value.localeCompare(b.value);
  });
}

/**
 * Filter suggestions matching the user's typed search query.
 * Matches case-insensitively.
 */
export function filterSuggestions(
  items: AutocompleteItem[],
  query: string
): AutocompleteItem[] {
  const sorted = sortSuggestions(items);
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return sorted;
  }
  return sorted.filter(item => {
    return item.normalized.includes(trimmed) || item.value.toLowerCase().includes(trimmed);
  });
}

/**
 * Import unique values from existing saved job applications so previous answers
 * are immediately available to the user upon loading.
 * Respects deleted values so items removed by the user in Manage Saved Answers are not resurrected.
 */
export function importValuesFromApplications(
  currentHistory: JobAutocompleteHistory | null,
  applications: JobApplication[]
): { history: JobAutocompleteHistory; hasChanges: boolean } {
  const history: JobAutocompleteHistory = currentHistory ? {
    location: [...(currentHistory.location || [])],
    workplaceType: [...(currentHistory.workplaceType || [])],
    employmentType: [...(currentHistory.employmentType || [])],
    deletedValues: {
      location: [...(currentHistory.deletedValues?.location || [])],
      workplaceType: [...(currentHistory.deletedValues?.workplaceType || [])],
      employmentType: [...(currentHistory.deletedValues?.employmentType || [])]
    },
    updatedAt: currentHistory.updatedAt || new Date().toISOString()
  } : createInitialHistory();

  let hasChanges = false;
  const nowIso = new Date().toISOString();

  // Helper to process a single field
  const processField = (
    fieldName: AutocompleteFieldType,
    rawVal: string | undefined,
    jobDateApplied?: string
  ) => {
    if (!rawVal || typeof rawVal !== 'string') return;
    const cleanDisplay = rawVal.trim().replace(/\s+/g, ' ');
    if (!cleanDisplay) return;

    const normalized = normalizeValue(cleanDisplay);
    if (!normalized) return;

    // Check if blacklisted / deleted by user
    if (history.deletedValues?.[fieldName]?.includes(normalized)) {
      return;
    }

    const list = history[fieldName];
    const existingIndex = list.findIndex(item => item.normalized === normalized);

    // Approximate recency from application dateApplied if valid
    let timestamp = nowIso;
    if (jobDateApplied && jobDateApplied.length >= 10) {
      try {
        const d = new Date(jobDateApplied);
        if (!isNaN(d.getTime())) {
          timestamp = d.toISOString();
        }
      } catch (e) {}
    }

    if (existingIndex >= 0) {
      // Item already in history; check if we should increase count or update recency
      const existing = list[existingIndex];
      // Keep existing count if it already tracks multiple, but ensure it reflects usage
      const newTimestamp = (existing.lastUsedAt && existing.lastUsedAt > timestamp) ? existing.lastUsedAt : timestamp;
      if (newTimestamp !== existing.lastUsedAt) {
        list[existingIndex] = {
          ...existing,
          lastUsedAt: newTimestamp
        };
        hasChanges = true;
      }
    } else {
      // New unique value discovered from past applications
      list.push({
        value: cleanDisplay,
        normalized,
        count: 1,
        lastUsedAt: timestamp,
        isDefault: false
      });
      hasChanges = true;
    }
  };

  for (const app of applications) {
    if (!app) continue;
    processField('location', app.location, app.dateApplied);
    processField('workplaceType', app.workplaceType, app.dateApplied);
    processField('employmentType', app.employmentType, app.dateApplied);
  }

  // Ensure standard defaults exist if not explicitly deleted
  for (const defWorkplace of DEFAULT_WORKPLACE_TYPES) {
    const norm = normalizeValue(defWorkplace);
    if (!history.deletedValues?.workplaceType?.includes(norm)) {
      if (!history.workplaceType.some(item => item.normalized === norm)) {
        history.workplaceType.push({
          value: defWorkplace,
          normalized: norm,
          count: 1,
          lastUsedAt: nowIso,
          isDefault: true
        });
        hasChanges = true;
      }
    }
  }

  for (const defEmployment of DEFAULT_EMPLOYMENT_TYPES) {
    const norm = normalizeValue(defEmployment);
    if (!history.deletedValues?.employmentType?.includes(norm)) {
      if (!history.employmentType.some(item => item.normalized === norm)) {
        history.employmentType.push({
          value: defEmployment,
          normalized: norm,
          count: 1,
          lastUsedAt: nowIso,
          isDefault: true
        });
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    history.updatedAt = nowIso;
  }

  return { history, hasChanges };
}

/**
 * Record values from a successfully saved job application.
 * Increments count, updates recency, preserves display capitalization, and removes from deleted list if re-added.
 */
export function recordSavedJobValues(
  currentHistory: JobAutocompleteHistory,
  entries: {
    location?: string;
    workplaceType?: string;
    employmentType?: string;
  }
): JobAutocompleteHistory {
  const nowIso = new Date().toISOString();
  const nextHistory: JobAutocompleteHistory = {
    location: [...(currentHistory.location || [])],
    workplaceType: [...(currentHistory.workplaceType || [])],
    employmentType: [...(currentHistory.employmentType || [])],
    deletedValues: {
      location: [...(currentHistory.deletedValues?.location || [])],
      workplaceType: [...(currentHistory.deletedValues?.workplaceType || [])],
      employmentType: [...(currentHistory.deletedValues?.employmentType || [])]
    },
    updatedAt: nowIso
  };

  const updateField = (fieldName: AutocompleteFieldType, rawVal?: string) => {
    if (!rawVal || typeof rawVal !== 'string') return;
    const cleanVal = rawVal.trim().replace(/\s+/g, ' ');
    if (!cleanVal) return; // Do not save blank entries

    const norm = normalizeValue(cleanVal);
    if (!norm) return;

    // Remove from deleted list if user intentionally typed and saved this value
    if (nextHistory.deletedValues?.[fieldName]?.includes(norm)) {
      nextHistory.deletedValues[fieldName] = (nextHistory.deletedValues[fieldName] || []).filter(n => n !== norm);
    }

    const list = nextHistory[fieldName];
    const index = list.findIndex(item => item.normalized === norm);

    if (index >= 0) {
      const existing = list[index];
      // If user typed a nicely capitalized version and existing was all lowercase, preserve the better version
      const preferredValue = (existing.value.toLowerCase() === existing.value && cleanVal.toLowerCase() !== cleanVal)
        ? cleanVal
        : existing.value;

      list[index] = {
        ...existing,
        value: preferredValue,
        count: existing.count + 1,
        lastUsedAt: nowIso
      };
    } else {
      list.push({
        value: cleanVal,
        normalized: norm,
        count: 1,
        lastUsedAt: nowIso,
        isDefault: false
      });
    }
  };

  updateField('location', entries.location);
  updateField('workplaceType', entries.workplaceType);
  updateField('employmentType', entries.employmentType);

  return nextHistory;
}

/**
 * Remove a suggestion item from autocomplete history.
 * Adds the item to deletedValues so it is not re-imported from existing job applications.
 * Does NOT modify or delete any job applications.
 */
export function removeSuggestionItem(
  currentHistory: JobAutocompleteHistory,
  fieldName: AutocompleteFieldType,
  normalizedValue: string
): JobAutocompleteHistory {
  const norm = normalizeValue(normalizedValue);
  const nowIso = new Date().toISOString();

  const currentDeleted = currentHistory.deletedValues?.[fieldName] || [];
  const nextDeleted = currentDeleted.includes(norm) ? currentDeleted : [...currentDeleted, norm];

  return {
    ...currentHistory,
    [fieldName]: (currentHistory[fieldName] || []).filter(item => item.normalized !== norm),
    deletedValues: {
      ...currentHistory.deletedValues,
      [fieldName]: nextDeleted
    },
    updatedAt: nowIso
  };
}

/**
 * Restores all standard default items for a field if deleted.
 */
export function restoreDefaults(
  currentHistory: JobAutocompleteHistory,
  fieldName: 'workplaceType' | 'employmentType'
): JobAutocompleteHistory {
  const nowIso = new Date().toISOString();
  const defaults = fieldName === 'workplaceType' ? DEFAULT_WORKPLACE_TYPES : DEFAULT_EMPLOYMENT_TYPES;

  let currentList = [...(currentHistory[fieldName] || [])];
  let deletedList = [...(currentHistory.deletedValues?.[fieldName] || [])];

  for (const defVal of defaults) {
    const norm = normalizeValue(defVal);
    deletedList = deletedList.filter(n => n !== norm);
    if (!currentList.some(item => item.normalized === norm)) {
      currentList.push({
        value: defVal,
        normalized: norm,
        count: 1,
        lastUsedAt: nowIso,
        isDefault: true
      });
    }
  }

  return {
    ...currentHistory,
    [fieldName]: currentList,
    deletedValues: {
      ...currentHistory.deletedValues,
      [fieldName]: deletedList
    },
    updatedAt: nowIso
  };
}
