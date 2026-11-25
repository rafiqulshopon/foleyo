import { createJsonStore } from '@/app/lib/local-store';

/** Per-course playback preferences. */
export interface CourseSettings {
  /** Seconds to skip at the start of every lesson. */
  introSkip?: number;
  /** Seconds before the end at which a lesson counts as finished. */
  outroSkip?: number;
  /** Playback speed remembered for this course. */
  playbackRate?: number;
}

const EMPTY: CourseSettings = {};
const store = createJsonStore<CourseSettings>('foleyo_course_settings_updated', EMPTY);

export const MAX_SKIP_SECONDS = 600;

function settingsKey(courseId: string) {
  return `foleyo_course_settings_${courseId}`;
}

export function readCourseSettings(courseId: string): CourseSettings {
  return store.read(settingsKey(courseId));
}

/** Merge a patch into the stored settings; `undefined` values remove a field. */
export function updateCourseSettings(courseId: string, patch: Partial<CourseSettings>) {
  const next: CourseSettings = { ...readCourseSettings(courseId), ...patch };
  for (const k of Object.keys(next) as (keyof CourseSettings)[]) {
    if (next[k] === undefined) delete next[k];
  }
  store.write(settingsKey(courseId), Object.keys(next).length ? next : null);
}

export function useCourseSettings(courseId: string | undefined): CourseSettings {
  return store.useValue(courseId ? settingsKey(courseId) : null);
}

/** Normalize user input for intro/outro skip: whole seconds, 0 → unset. */
export function sanitizeSkipSeconds(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(MAX_SKIP_SECONDS, Math.round(value));
}
