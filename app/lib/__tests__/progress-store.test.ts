import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress,
  saveProgress,
  createEmptyProgress,
  updateLessonProgress,
  toggleLessonComplete,
  getCompletionStats,
  getLessonProgress,
  computeWatchTimeStats,
} from '@/app/lib/progress-store';
import type { Course } from '@/app/types';

beforeEach(() => {
  localStorage.clear();
});

describe('createEmptyProgress', () => {
  it('returns a fresh progress object', () => {
    const p = createEmptyProgress('My Course');
    expect(p).toEqual({
      courseName: 'My Course',
      lastLessonId: '',
      lessons: {},
      lastOpened: expect.any(Number),
    });
  });
});

describe('saveProgress / loadProgress roundtrip', () => {
  it('persists and reloads progress under a normalized key', () => {
    const p = updateLessonProgress(createEmptyProgress('My Course'), 'root/01.mp4', {
      lastPosition: 42,
    });
    saveProgress(p);

    const loaded = loadProgress('My Course');
    expect(loaded).not.toBeNull();
    expect(loaded!.lessons['root/01.mp4'].lastPosition).toBe(42);
    expect(loaded!.lastLessonId).toBe('root/01.mp4');
  });

  it('returns null for unknown courses', () => {
    expect(loadProgress('Never Seen')).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('foleyo_progress_corrupt', '{not json');
    expect(loadProgress('Corrupt')).toBeNull();
  });
});

describe('updateLessonProgress', () => {
  it('merges updates into the lesson entry and tracks the last lesson', () => {
    const p = createEmptyProgress('Course');
    const updated = updateLessonProgress(p, 'a', { lastPosition: 10 });

    expect(updated.lastLessonId).toBe('a');
    expect(updated.lessons.a.lastPosition).toBe(10);
    expect(updated.lessons.a.lastWatched).toBeGreaterThan(0);
  });

  it('does not mutate the input', () => {
    const p = createEmptyProgress('Course');
    const updated = updateLessonProgress(p, 'a', { completed: true });

    expect(p.lessons.a).toBeUndefined();
    expect(p.lastLessonId).toBe('');
    expect(updated.lessons.a.completed).toBe(true);
  });

  it('preserves other lessons', () => {
    let p = createEmptyProgress('Course');
    p = updateLessonProgress(p, 'a', { completed: true });
    p = updateLessonProgress(p, 'b', {});

    expect(p.lessons.a.completed).toBe(true);
    expect(p.lastLessonId).toBe('b');
  });
});

describe('toggleLessonComplete', () => {
  it('toggles completion both ways', () => {
    let p = createEmptyProgress('Course');
    p = toggleLessonComplete(p, 'a');
    expect(p.lessons.a.completed).toBe(true);

    p = toggleLessonComplete(p, 'a');
    expect(p.lessons.a.completed).toBe(false);
  });
});

describe('getLessonProgress', () => {
  it('returns a default entry for unseen lessons', () => {
    const p = createEmptyProgress('Course');
    expect(getLessonProgress(p, 'missing')).toEqual({
      completed: false,
      lastPosition: 0,
      lastWatched: 0,
    });
  });
});

describe('getCompletionStats', () => {
  it('counts completed lessons and computes percentage', () => {
    let p = createEmptyProgress('Course');
    p = updateLessonProgress(p, 'a', { completed: true });
    p = updateLessonProgress(p, 'b', { completed: true });
    p = updateLessonProgress(p, 'c', {});

    expect(getCompletionStats(p, ['a', 'b', 'c'])).toEqual({
      completed: 2,
      total: 3,
      percentage: 67,
    });
  });

  it('handles an empty lesson list', () => {
    expect(getCompletionStats(createEmptyProgress('Course'), [])).toEqual({
      completed: 0,
      total: 0,
      percentage: 0,
    });
  });
});

describe('computeWatchTimeStats', () => {
  const fakeCourse = {
    name: 'Course',
    modules: [
      {
        id: 'm1',
        title: 'Module 1',
        folderName: 'Module 1',
        index: 0,
        lessons: [
          {
            id: 'a',
            moduleId: 'm1',
            title: 'A',
            fileName: 'a.mp4',
            subtitles: [],
            fileHandle: {} as never,
          },
          {
            id: 'b',
            moduleId: 'm1',
            title: 'B',
            fileName: 'b.mp4',
            subtitles: [],
            fileHandle: {} as never,
          },
        ],
      },
    ],
  } as unknown as Course;

  it('returns zeros without a course', () => {
    expect(
      computeWatchTimeStats(null, createEmptyProgress('Course'), {})
    ).toEqual({
      totalSeconds: 0,
      watchedSeconds: 0,
      remainingSeconds: 0,
      watchedPercentage: 0,
    });
  });

  it('counts completed lessons as fully watched and caps partials at duration', () => {
    let p = createEmptyProgress('Course');
    p = updateLessonProgress(p, 'a', { completed: true });
    // 150s position on a 100s lesson → capped at 100
    p = updateLessonProgress(p, 'b', { lastPosition: 150 });

    const stats = computeWatchTimeStats(fakeCourse, p, { a: 100, b: 100 });
    expect(stats.totalSeconds).toBe(200);
    expect(stats.watchedSeconds).toBe(200);
    expect(stats.remainingSeconds).toBe(0);
    expect(stats.watchedPercentage).toBe(100);
  });

  it('ignores lessons without a known duration', () => {
    let p = createEmptyProgress('Course');
    p = updateLessonProgress(p, 'a', { lastPosition: 50 });

    const stats = computeWatchTimeStats(fakeCourse, p, { a: 100 });
    expect(stats.totalSeconds).toBe(100);
    expect(stats.watchedSeconds).toBe(50);
    expect(stats.remainingSeconds).toBe(50);
    expect(stats.watchedPercentage).toBe(50);
  });
});
