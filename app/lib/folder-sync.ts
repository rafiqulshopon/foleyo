import type { CourseProgress } from '@/app/types';
import type { CourseBookmarks } from '@/app/lib/bookmarks';
import type { CourseSettings } from '@/app/lib/course-settings';
import type { LessonOverrides } from '@/app/lib/lesson-overrides';
import { readCourseBookmarks } from '@/app/lib/bookmarks';
import { readCourseSettings } from '@/app/lib/course-settings';
import { readLessonOverrides } from '@/app/lib/lesson-overrides';
import { saveProgress } from '@/app/lib/progress-store';

export const COURSE_SYNC_FILENAME = '.foleyo.json';

export interface CourseSyncPayload {
  app: 'foleyo';
  version: 1;
  courseName: string;
  updatedAt: number;
  progress: CourseProgress;
  notes: Record<string, string>;
  bookmarks: CourseBookmarks;
  settings: CourseSettings;
  overrides: LessonOverrides;
}

function readCourseNotesRaw(courseName: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`foleyo_notes_${courseName}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Build a portable `.foleyo.json` payload for a single course.
 */
export function buildCourseSyncPayload(
  courseName: string,
  progress: CourseProgress,
): CourseSyncPayload {
  return {
    app: 'foleyo',
    version: 1,
    courseName,
    updatedAt: Date.now(),
    progress,
    notes: readCourseNotesRaw(courseName),
    bookmarks: readCourseBookmarks(courseName),
    settings: readCourseSettings(courseName),
    overrides: readLessonOverrides(courseName),
  };
}

/**
 * Read `.foleyo.json` from a course directory handle if it exists and is valid.
 */
export async function readCourseSyncFile(
  dirHandle: FileSystemDirectoryHandle,
): Promise<CourseSyncPayload | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(COURSE_SYNC_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<CourseSyncPayload>;
    if (parsed?.app !== 'foleyo' || !parsed.progress) return null;
    return {
      app: 'foleyo',
      version: 1,
      courseName: parsed.courseName ?? parsed.progress.courseName ?? '',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      progress: parsed.progress,
      notes: parsed.notes ?? {},
      bookmarks: parsed.bookmarks ?? {},
      settings: parsed.settings ?? {},
      overrides: parsed.overrides ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Write `.foleyo.json` into the course directory so progress, notes, bookmarks,
 * and settings travel with the folder (e.g. on an external drive).
 * Requests `readwrite` permission if not already granted.
 */
export async function writeCourseSyncFile(
  dirHandle: FileSystemDirectoryHandle,
  payload: CourseSyncPayload,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    if (typeof dirHandle.requestPermission === 'function') {
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        return {
          ok: false,
          reason: 'Write permission was not granted for this folder.',
        };
      }
    }

    const fileHandle = await dirHandle.getFileHandle(COURSE_SYNC_FILENAME, {
      create: true,
    });
    if (typeof fileHandle.createWritable !== 'function') {
      return {
        ok: false,
        reason: 'This browser does not support writing files directly to disk.',
      };
    }

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Failed to write .foleyo.json',
    };
  }
}

/**
 * Apply a `.foleyo.json` sync payload into localStorage for `courseName`,
 * returning the merged CourseProgress so the caller can update React state.
 */
export function applyCourseSyncPayload(
  courseName: string,
  payload: CourseSyncPayload,
  currentProgress: CourseProgress,
): CourseProgress {
  // Merge lesson progress by keeping the most recently watched entry per lesson
  const mergedLessons = { ...currentProgress.lessons };
  for (const [lessonId, incoming] of Object.entries(
    payload.progress.lessons ?? {},
  )) {
    const existing = mergedLessons[lessonId];
    if (!existing || incoming.lastWatched > existing.lastWatched) {
      mergedLessons[lessonId] = incoming;
    }
  }

  const mergedProgress: CourseProgress = {
    courseName,
    lastLessonId:
      payload.updatedAt > currentProgress.lastOpened && payload.progress.lastLessonId
        ? payload.progress.lastLessonId
        : currentProgress.lastLessonId || payload.progress.lastLessonId,
    lessons: mergedLessons,
    lastOpened: Math.max(currentProgress.lastOpened, payload.progress.lastOpened || 0),
  };

  saveProgress(mergedProgress);

  // Merge notes (fill in any missing or non-empty incoming notes)
  if (payload.notes && Object.keys(payload.notes).length > 0) {
    const existingNotes = readCourseNotesRaw(courseName);
    const mergedNotes = { ...existingNotes, ...payload.notes };
    try {
      localStorage.setItem(`foleyo_notes_${courseName}`, JSON.stringify(mergedNotes));
      window.dispatchEvent(new Event('foleyo_notes_updated'));
    } catch {
      // ignore storage errors
    }
  }

  // Merge bookmarks
  if (payload.bookmarks && Object.keys(payload.bookmarks).length > 0) {
    const existingBookmarks = readCourseBookmarks(courseName);
    const mergedBookmarks: CourseBookmarks = { ...existingBookmarks };
    for (const [lessonId, list] of Object.entries(payload.bookmarks)) {
      const prev = mergedBookmarks[lessonId] ?? [];
      const byTime = new Map(prev.map((b) => [b.time, b]));
      for (const b of list) {
        if (!byTime.has(b.time)) byTime.set(b.time, b);
      }
      mergedBookmarks[lessonId] = Array.from(byTime.values()).sort(
        (a, b) => a.time - b.time,
      );
    }
    try {
      localStorage.setItem(
        `foleyo_bookmarks_${courseName}`,
        JSON.stringify(mergedBookmarks),
      );
      window.dispatchEvent(new Event('foleyo_bookmarks_updated'));
    } catch {
      // ignore
    }
  }

  // Merge settings
  if (payload.settings && Object.keys(payload.settings).length > 0) {
    const existingSettings = readCourseSettings(courseName);
    const mergedSettings = { ...payload.settings, ...existingSettings };
    try {
      localStorage.setItem(
        `foleyo_course_settings_${courseName}`,
        JSON.stringify(mergedSettings),
      );
      window.dispatchEvent(new Event('foleyo_course_settings_updated'));
    } catch {
      // ignore
    }
  }

  // Merge overrides
  if (payload.overrides && Object.keys(payload.overrides).length > 0) {
    const existingOverrides = readLessonOverrides(courseName);
    const mergedOverrides: LessonOverrides = {
      titles: {
        ...(payload.overrides.titles ?? {}),
        ...(existingOverrides.titles ?? {}),
      },
      hidden: {
        ...(payload.overrides.hidden ?? {}),
        ...(existingOverrides.hidden ?? {}),
      },
    };
    try {
      localStorage.setItem(
        `foleyo_lesson_overrides_${courseName}`,
        JSON.stringify(mergedOverrides),
      );
      window.dispatchEvent(new Event('foleyo_lesson_overrides_updated'));
    } catch {
      // ignore
    }
  }

  return mergedProgress;
}
