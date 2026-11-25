import { createJsonStore } from '@/app/lib/local-store';

/** A timestamped note attached to a moment in a lesson. */
export interface Bookmark {
  id: string;
  time: number; // whole seconds
  text: string;
  createdAt: number;
}

/** lessonId → bookmarks sorted by time */
export type CourseBookmarks = Record<string, Bookmark[]>;

const EMPTY: CourseBookmarks = {};
const store = createJsonStore<CourseBookmarks>('foleyo_bookmarks_updated', EMPTY);

function bookmarksKey(courseId: string) {
  return `foleyo_bookmarks_${courseId}`;
}

export function readCourseBookmarks(courseId: string): CourseBookmarks {
  return store.read(bookmarksKey(courseId));
}

function writeLesson(courseId: string, lessonId: string, list: Bookmark[]) {
  const next = { ...readCourseBookmarks(courseId) };
  if (list.length === 0) delete next[lessonId];
  else next[lessonId] = [...list].sort((a, b) => a.time - b.time);
  store.write(bookmarksKey(courseId), Object.keys(next).length ? next : null);
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Add a bookmark at `time` (floored to the second). If one already exists at
 * that second it is returned instead, so mashing the shortcut doesn't create
 * duplicates.
 */
export function addBookmark(
  courseId: string,
  lessonId: string,
  time: number,
  text = '',
): Bookmark {
  const second = Math.max(0, Math.floor(time));
  const list = readCourseBookmarks(courseId)[lessonId] ?? [];
  const existing = list.find((b) => b.time === second);
  if (existing) return existing;

  const bookmark: Bookmark = { id: makeId(), time: second, text, createdAt: Date.now() };
  writeLesson(courseId, lessonId, [...list, bookmark]);
  return bookmark;
}

export function updateBookmarkText(
  courseId: string,
  lessonId: string,
  id: string,
  text: string,
) {
  const list = readCourseBookmarks(courseId)[lessonId] ?? [];
  if (!list.some((b) => b.id === id)) return;
  writeLesson(
    courseId,
    lessonId,
    list.map((b) => (b.id === id ? { ...b, text } : b)),
  );
}

export function removeBookmark(courseId: string, lessonId: string, id: string) {
  const list = readCourseBookmarks(courseId)[lessonId] ?? [];
  writeLesson(courseId, lessonId, list.filter((b) => b.id !== id));
}

export function useCourseBookmarks(courseId: string | undefined): CourseBookmarks {
  return store.useValue(courseId ? bookmarksKey(courseId) : null);
}
