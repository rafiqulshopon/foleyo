import { CourseProgress, LessonProgress } from '@/app/types';

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
 * Update progress for a specific lesson.
 */
export function updateLessonProgress(
  progress: CourseProgress,
  lessonId: string,
  update: Partial<LessonProgress>
): CourseProgress {
  const current = getLessonProgress(progress, lessonId);
  const updated: CourseProgress = {
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

  saveProgress(updated);
  return updated;
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
