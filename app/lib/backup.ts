/**
 * Full backup & restore of all Foleyo data stored in localStorage
 * (course progress, lesson notes, bookmarks, course settings, lesson
 * overrides, watch history, and player preferences).
 */

export const BACKUP_VERSION = 1;
export const FOLEYO_KEY_PREFIX = 'foleyo_';

export interface FoleyoBackup {
  app: 'foleyo';
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

export interface BackupSummary {
  totalKeys: number;
  coursesCount: number;
  notesCoursesCount: number;
  bookmarksCoursesCount: number;
  hasWatchHistory: boolean;
  exportedAt: string;
}

const FOLEYO_UPDATE_EVENTS = [
  'foleyo_notes_updated',
  'foleyo_bookmarks_updated',
  'foleyo_course_settings_updated',
  'foleyo_lesson_overrides_updated',
  'foleyo_watch_history_updated',
];

/**
 * Collect all `foleyo_*` localStorage entries into a portable backup object.
 */
export function createBackup(now: Date = new Date()): FoleyoBackup {
  const data: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(FOLEYO_KEY_PREFIX)) continue;
      const val = localStorage.getItem(key);
      if (val !== null) {
        data[key] = val;
      }
    }
  }
  return {
    app: 'foleyo',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

/**
 * Parse and validate a JSON backup string. Throws an Error with a user-facing
 * message if the file is not a valid Foleyo backup.
 */
export function parseBackupJson(raw: string): FoleyoBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup format.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.app !== 'foleyo' || typeof obj.data !== 'object' || obj.data === null) {
    throw new Error('This file is not a Foleyo backup.');
  }

  const cleanData: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj.data as Record<string, unknown>)) {
    if (!k.startsWith(FOLEYO_KEY_PREFIX)) continue;
    if (typeof v === 'string') {
      cleanData[k] = v;
    }
  }

  return {
    app: 'foleyo',
    version: typeof obj.version === 'number' ? obj.version : 1,
    exportedAt:
      typeof obj.exportedAt === 'string'
        ? obj.exportedAt
        : new Date().toISOString(),
    data: cleanData,
  };
}

/**
 * Summarize the contents of a backup for preview before importing.
 */
export function summarizeBackup(backup: FoleyoBackup): BackupSummary {
  const keys = Object.keys(backup.data);
  const coursesCount = keys.filter((k) => k.startsWith('foleyo_progress_')).length;
  const notesCoursesCount = keys.filter((k) => k.startsWith('foleyo_notes_')).length;
  const bookmarksCoursesCount = keys.filter((k) =>
    k.startsWith('foleyo_bookmarks_'),
  ).length;
  const hasWatchHistory = keys.includes('foleyo_watch_history');

  return {
    totalKeys: keys.length,
    coursesCount,
    notesCoursesCount,
    bookmarksCoursesCount,
    hasWatchHistory,
    exportedAt: backup.exportedAt,
  };
}

/**
 * Merge two JSON-encoded watch history objects by taking the max seconds per day.
 */
function mergeWatchHistoryRaw(existingRaw: string, incomingRaw: string): string {
  try {
    const existing = JSON.parse(existingRaw) as {
      days?: Record<string, number>;
      dailyGoalMinutes?: number;
    };
    const incoming = JSON.parse(incomingRaw) as {
      days?: Record<string, number>;
      dailyGoalMinutes?: number;
    };
    const days: Record<string, number> = { ...(existing.days ?? {}) };
    for (const [dateKey, secs] of Object.entries(incoming.days ?? {})) {
      days[dateKey] = Math.max(days[dateKey] ?? 0, secs);
    }
    return JSON.stringify({
      days,
      dailyGoalMinutes:
        incoming.dailyGoalMinutes ?? existing.dailyGoalMinutes ?? 30,
    });
  } catch {
    return incomingRaw;
  }
}

/**
 * Restore a validated backup into localStorage.
 * - `replace`: wipes all existing `foleyo_*` keys before writing the backup.
 * - `merge`: preserves existing keys not present in the backup, and merges
 *   watch-history days so neither machine's streak is lost.
 */
export function restoreBackup(
  backup: FoleyoBackup,
  mode: 'merge' | 'replace' = 'merge',
): { importedKeys: number } {
  if (typeof window === 'undefined') return { importedKeys: 0 };

  if (mode === 'replace') {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(FOLEYO_KEY_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }

  let importedKeys = 0;
  for (const [key, value] of Object.entries(backup.data)) {
    if (!key.startsWith(FOLEYO_KEY_PREFIX)) continue;

    if (mode === 'merge' && key === 'foleyo_watch_history') {
      const existing = localStorage.getItem(key);
      localStorage.setItem(
        key,
        existing ? mergeWatchHistoryRaw(existing, value) : value,
      );
    } else {
      localStorage.setItem(key, value);
    }
    importedKeys++;
  }

  for (const evt of FOLEYO_UPDATE_EVENTS) {
    window.dispatchEvent(new Event(evt));
  }

  return { importedKeys };
}

/**
 * Trigger a browser download of the full JSON backup.
 */
export function downloadBackupFile(backup: FoleyoBackup = createBackup()): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const datePart = backup.exportedAt.slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foleyo-backup-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
