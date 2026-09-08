import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress,
  saveProgress,
  createEmptyProgress,
  updateLessonProgress,
  toggleLessonComplete,
  getCompletionStats,
  getLessonProgress,
} from '@/app/lib/progress-store';

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
