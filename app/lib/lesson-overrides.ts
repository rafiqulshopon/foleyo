import { createJsonStore } from '@/app/lib/local-store';
import type { Course, Lesson } from '@/app/types';

/**
 * Per-course lesson display overrides stored in localStorage.
 * Lets users rename messy filenames or hide unwanted lessons without
 * modifying any files on disk.
 */
export interface LessonOverrides {
  /** Custom display titles keyed by lesson.id */
  titles?: Record<string, string>;
  /** Hidden lesson flags keyed by lesson.id */
  hidden?: Record<string, boolean>;
}

const EMPTY: LessonOverrides = {};
const store = createJsonStore<LessonOverrides>(
  'foleyo_lesson_overrides_updated',
  EMPTY
);

function overridesKey(courseId: string): string {
  return `foleyo_lesson_overrides_${courseId}`;
}

export function readLessonOverrides(courseId: string): LessonOverrides {
  return store.read(overridesKey(courseId));
}

export function useLessonOverrides(
  courseId: string | undefined
): LessonOverrides {
  return store.useValue(courseId ? overridesKey(courseId) : null);
}

function writeClean(courseId: string, next: LessonOverrides) {
  const hasTitles = next.titles && Object.keys(next.titles).length > 0;
  const hasHidden = next.hidden && Object.keys(next.hidden).length > 0;
  if (!hasTitles && !hasHidden) {
    store.write(overridesKey(courseId), null);
    return;
  }
  const cleaned: LessonOverrides = {};
  if (hasTitles) cleaned.titles = next.titles;
  if (hasHidden) cleaned.hidden = next.hidden;
  store.write(overridesKey(courseId), cleaned);
}

/**
 * Set a custom display title for a lesson. Passing null, empty string, or
 * whitespace reverts the lesson to its original parsed title.
 */
export function renameLesson(
  courseId: string,
  lessonId: string,
  title: string | null
) {
  const current = readLessonOverrides(courseId);
  const trimmed = title?.trim() ?? '';
  const nextTitles = { ...(current.titles ?? {}) };
  if (!trimmed) {
    delete nextTitles[lessonId];
  } else {
    nextTitles[lessonId] = trimmed;
  }
  writeClean(courseId, { ...current, titles: nextTitles });
}

/**
 * Hide or unhide a single lesson without touching disk.
 */
export function setLessonHidden(
  courseId: string,
  lessonId: string,
  hidden: boolean
) {
  const current = readLessonOverrides(courseId);
  const nextHidden = { ...(current.hidden ?? {}) };
  if (hidden) {
    nextHidden[lessonId] = true;
  } else {
    delete nextHidden[lessonId];
  }
  writeClean(courseId, { ...current, hidden: nextHidden });
}

/**
 * Unhide every hidden lesson in the course.
 */
export function unhideAllLessons(courseId: string) {
  const current = readLessonOverrides(courseId);
  if (!current.hidden || Object.keys(current.hidden).length === 0) return;
  writeClean(courseId, { ...current, hidden: undefined });
}

/**
 * Resolve the display title for a lesson, applying any user rename override.
 */
export function getDisplayTitle(
  lesson: Pick<Lesson, 'id' | 'title'>,
  overrides: LessonOverrides
): string {
  return overrides.titles?.[lesson.id] || lesson.title;
}

/**
 * Check whether a lesson is currently hidden.
 */
export function isLessonHidden(
  lessonId: string,
  overrides: LessonOverrides
): boolean {
  return Boolean(overrides.hidden?.[lessonId]);
}

/**
 * Return all non-hidden lessons in course order.
 */
export function getVisibleLessons(
  course: Course | null,
  overrides: LessonOverrides
): Lesson[] {
  if (!course) return [];
  return course.modules
    .flatMap((m) => m.lessons)
    .filter((l) => !isLessonHidden(l.id, overrides));
}

/**
 * Count how many lessons in the course are currently hidden.
 */
export function countHiddenLessons(
  course: Course | null,
  overrides: LessonOverrides
): number {
  if (!course || !overrides.hidden) return 0;
  let count = 0;
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (overrides.hidden[lesson.id]) count++;
    }
  }
  return count;
}
