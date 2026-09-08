import { Course, CourseProgress, LessonProgress } from '@/app/types';

const STORAGE_KEY_PREFIX = 'foleyo_progress_';

function getStorageKey(courseName: string): string {
  return `${STORAGE_KEY_PREFIX}${courseName.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Load progress for a course from localStorage.
 */
export function loadProgress(courseName: string): CourseProgress | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(getStorageKey(courseName));
    if (!raw) return null;
    return JSON.parse(raw) as CourseProgress;
  } catch {
    return null;
  }
}

/**
 * Save progress for a course to localStorage.
 */
export function saveProgress(progress: CourseProgress): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      getStorageKey(progress.courseName),
      JSON.stringify(progress)
    );
  } catch (e) {
    console.warn('Failed to save progress to localStorage:', e);
  }
}

/**
 * Get or create progress entry for a specific lesson.
 */
export function getLessonProgress(
  progress: CourseProgress,
  lessonId: string
): LessonProgress {
  return (
    progress.lessons[lessonId] || {
      completed: false,
      lastPosition: 0,
      lastWatched: 0,
    }
  );
}

/**
 * Update progress for a specific lesson. Pure — persistence is owned by the
 * course provider's single save funnel, so this is safe inside setState
 * updaters (which React may invoke twice in StrictMode).
 */
export function updateLessonProgress(
  progress: CourseProgress,
  lessonId: string,
  update: Partial<LessonProgress>
): CourseProgress {
  const current = getLessonProgress(progress, lessonId);
  return {
    ...progress,
    lessons: {
      ...progress.lessons,
      [lessonId]: {
        ...current,
        ...update,
        lastWatched: Date.now(),
      },
    },
    lastLessonId: lessonId,
    lastOpened: Date.now(),
  };
}

/**
 * Toggle completion status for a lesson.
 */
export function toggleLessonComplete(
  progress: CourseProgress,
  lessonId: string
): CourseProgress {
  const current = getLessonProgress(progress, lessonId);
  return updateLessonProgress(progress, lessonId, {
    completed: !current.completed,
  });
}

/**
 * Create a fresh progress object for a new course.
 */
export function createEmptyProgress(courseName: string): CourseProgress {
  return {
    courseName,
    lastLessonId: '',
    lessons: {},
    lastOpened: Date.now(),
  };
}

/**
 * Calculate completion stats for a set of lesson IDs.
 */
export function getCompletionStats(
  progress: CourseProgress,
  lessonIds: string[]
): { completed: number; total: number; percentage: number } {
  const completed = lessonIds.filter(
    (id) => progress.lessons[id]?.completed
  ).length;
  const total = lessonIds.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}

export interface WatchTimeStats {
  totalSeconds: number;
  watchedSeconds: number;
  remainingSeconds: number;
  watchedPercentage: number;
}

const EMPTY_WATCH_TIME: WatchTimeStats = {
  totalSeconds: 0,
  watchedSeconds: 0,
  remainingSeconds: 0,
  watchedPercentage: 0,
};

/**
 * Watch-time stats across all lessons with a known duration. Completed
 * lessons count as fully watched; partial lessons count up to their last
 * position.
 */
export function computeWatchTimeStats(
  course: Course | null,
  progress: CourseProgress,
  lessonDurations: Record<string, number>
): WatchTimeStats {
  if (!course) return EMPTY_WATCH_TIME;

  const allLessons = course.modules.flatMap((m) => m.lessons);
  let totalSeconds = 0;
  let watchedSeconds = 0;

  for (const lesson of allLessons) {
    const dur = lessonDurations[lesson.id];
    if (dur && dur > 0) {
      totalSeconds += dur;
      const lessonProg = progress.lessons[lesson.id];
      if (lessonProg?.completed) {
        watchedSeconds += dur;
      } else if (lessonProg?.lastPosition > 0) {
        watchedSeconds += Math.min(lessonProg.lastPosition, dur);
      }
    }
  }

  const remainingSeconds = Math.max(0, totalSeconds - watchedSeconds);
  const watchedPercentage =
    totalSeconds > 0 ? Math.round((watchedSeconds / totalSeconds) * 100) : 0;

  return { totalSeconds, watchedSeconds, remainingSeconds, watchedPercentage };
}
