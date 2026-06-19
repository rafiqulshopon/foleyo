import { get, set } from 'idb-keyval';
import { Course } from '@/app/types';

/**
 * Metadata snapshot of a recently opened course,
 * stored in IndexedDB so the welcome screen can show course cards
 * without needing to re-parse the directory.
 */
export interface RecentCourse {
  /** Cleaned course name (derived from folder name) */
  name: string;
  /** Raw folder name on disk */
  folderName: string;
  /** Total number of video lessons */
  totalLessons: number;
  /** Number of completed lessons (snapshot at last open) */
  completedLessons: number;
  /** Number of modules */
  totalModules: number;
  /** Timestamp of last time this course was opened */
  lastOpenedAt: number;
  /** Title of the last lesson the user was watching */
  lastLessonTitle: string;
  /** Module title of the last lesson */
  lastLessonModule: string;
  /** Completion percentage 0-100 */
  percentage: number;
}

const RECENT_COURSES_KEY = 'foleyo_recent_courses';
const DIR_HANDLE_PREFIX = 'foleyo_dir_handle_';
const MAX_RECENT = 20;

/**
 * Get the IndexedDB key for a course's directory handle.
 */
function dirHandleKey(folderName: string): string {
  return `${DIR_HANDLE_PREFIX}${folderName}`;
}

/**
 * Load all recent courses from IndexedDB, sorted by lastOpenedAt desc.
 */
export async function loadRecentCourses(): Promise<RecentCourse[]> {
  try {
    const courses = await get<RecentCourse[]>(RECENT_COURSES_KEY);
    if (!courses) return [];
    return courses.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  } catch {
    return [];
  }
}

/**
 * Save or update a recent course entry + its directory handle.
 */
export async function saveRecentCourse(
  course: RecentCourse,
  dirHandle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    // Save directory handle separately (structured-cloneable)
    await set(dirHandleKey(course.folderName), dirHandle);

    // Update the recent courses list
    const existing = await loadRecentCourses();
    const filtered = existing.filter((c) => c.folderName !== course.folderName);
    const updated = [course, ...filtered].slice(0, MAX_RECENT);
    await set(RECENT_COURSES_KEY, updated);
  } catch (e) {
    console.warn('Failed to save recent course:', e);
  }
}

/**
 * Update just the metadata for an existing recent course (e.g. progress changed).
 */
export async function updateRecentCourseMetadata(
  folderName: string,
  update: Partial<RecentCourse>
): Promise<void> {
  try {
    const existing = await loadRecentCourses();
    const idx = existing.findIndex((c) => c.folderName === folderName);
    if (idx === -1) return;
    existing[idx] = { ...existing[idx], ...update, lastOpenedAt: Date.now() };
    await set(RECENT_COURSES_KEY, existing);
  } catch (e) {
    console.warn('Failed to update recent course metadata:', e);
  }
}

/**
 * Get the stored directory handle for a course.
 */
export async function getDirectoryHandle(
  folderName: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(dirHandleKey(folderName));
    return handle || null;
  } catch {
    return null;
  }
}

/**
 * Remove a recent course from the list and its stored handle.
 */
export async function removeRecentCourse(folderName: string): Promise<void> {
  try {
    const existing = await loadRecentCourses();
    const filtered = existing.filter((c) => c.folderName !== folderName);
    await set(RECENT_COURSES_KEY, filtered);
    // We don't delete the handle key — idb-keyval doesn't have a del by default
    // but we can set it to undefined
    await set(dirHandleKey(folderName), undefined);
  } catch (e) {
    console.warn('Failed to remove recent course:', e);
  }
}

/**
 * Try to restore permission for a stored directory handle.
 * Returns 'granted' | 'prompt' | 'denied' | null (if no handle found).
 */
export async function checkHandlePermission(
  folderName: string
): Promise<'granted' | 'prompt' | 'denied' | null> {
  const handle = await getDirectoryHandle(folderName);
  if (!handle) return null;

  try {
    const status = await handle.queryPermission({ mode: 'read' });
    return status;
  } catch {
    return null;
  }
}

/**
 * Cache the parsed course structure (including file handles).
 */
export async function saveCourseCache(folderName: string, course: Course): Promise<void> {
  try {
    await set(`foleyo_course_cache_${folderName}`, course);
  } catch (e) {
    console.warn('Failed to save course cache:', e);
  }
}

/**
 * Load the parsed course structure from cache.
 */
export async function getCourseCache(folderName: string): Promise<Course | null> {
  try {
    const course = await get<Course>(`foleyo_course_cache_${folderName}`);
    return course || null;
  } catch {
    return null;
  }
}

/**
 * Request read permission for a stored directory handle.
 * Returns true if permission was granted.
 */
export async function requestHandlePermission(
  folderName: string
): Promise<boolean> {
  const handle = await getDirectoryHandle(folderName);
  if (!handle) return false;

  try {
    const status = await handle.requestPermission({ mode: 'read' });
    return status === 'granted';
  } catch {
    return false;
  }
}
