import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addBookmark,
  updateBookmarkText,
  removeBookmark,
  readCourseBookmarks,
  useCourseBookmarks,
} from '@/app/lib/bookmarks';
import {
  readCourseSettings,
  updateCourseSettings,
  sanitizeSkipSeconds,
  useCourseSettings,
} from '@/app/lib/course-settings';
import {
  clampPlaybackRate,
  stepPlaybackRate,
  playbackRateOptions,
  formatPlaybackRate,
} from '@/app/lib/playback-speed';

beforeEach(() => {
  localStorage.clear();
});

describe('bookmarks', () => {
  it('adds sorted bookmarks, deduplicates the same second, updates, and removes', () => {
    const b2 = addBookmark('Course', 'l1', 90.8, 'Later');
    const b1 = addBookmark('Course', 'l1', 12.2, 'Earlier');
    const dup = addBookmark('Course', 'l1', 12.9, 'Ignored');

    expect(dup.id).toBe(b1.id);
    expect(readCourseBookmarks('Course').l1.map((b) => b.time)).toEqual([12, 90]);

    updateBookmarkText('Course', 'l1', b1.id, 'Updated');
    expect(readCourseBookmarks('Course').l1[0].text).toBe('Updated');

    removeBookmark('Course', 'l1', b1.id);
    removeBookmark('Course', 'l1', b2.id);
    expect(readCourseBookmarks('Course')).toEqual({});
  });

  it('notifies useCourseBookmarks subscribers reactively', () => {
    const { result } = renderHook(() => useCourseBookmarks('Course'));
    expect(result.current).toEqual({});

    act(() => {
      addBookmark('Course', 'l1', 42, 'Check this');
    });
    expect(result.current.l1).toHaveLength(1);
    expect(result.current.l1[0].time).toBe(42);
  });
});

describe('course-settings', () => {
  it('persists introSkip, outroSkip, and playbackRate per course', () => {
    const { result } = renderHook(() => useCourseSettings('Course A'));
    expect(result.current).toEqual({});

    act(() => {
      updateCourseSettings('Course A', { introSkip: 8, playbackRate: 1.15 });
    });
    expect(result.current).toEqual({ introSkip: 8, playbackRate: 1.15 });
    expect(readCourseSettings('Course B')).toEqual({});

    act(() => {
      updateCourseSettings('Course A', { introSkip: undefined });
    });
    expect(result.current).toEqual({ playbackRate: 1.15 });
  });

  it('sanitizes skip seconds', () => {
    expect(sanitizeSkipSeconds(0)).toBeUndefined();
    expect(sanitizeSkipSeconds(-3)).toBeUndefined();
    expect(sanitizeSkipSeconds(8.4)).toBe(8);
    expect(sanitizeSkipSeconds(9999)).toBe(600);
  });
});

describe('playback-speed', () => {
  it('clamps and rounds playback rates', () => {
    expect(clampPlaybackRate(0.1)).toBe(0.25);
    expect(clampPlaybackRate(10)).toBe(4);
    expect(clampPlaybackRate(1.156)).toBe(1.16);
  });

  it('steps in fine 0.05 increments and snaps off-grid values', () => {
    expect(stepPlaybackRate(1, 1)).toBe(1.05);
    expect(stepPlaybackRate(1.1, 1)).toBe(1.15);
    expect(stepPlaybackRate(1.15, -1)).toBe(1.1);
    expect(stepPlaybackRate(1.12, 1)).toBe(1.15);
    expect(stepPlaybackRate(1.12, -1)).toBe(1.1);
  });

  it('includes custom rates in sorted options and formats cleanly', () => {
    const opts = playbackRateOptions(1.33);
    expect(opts).toContain(1.1);
    expect(opts).toContain(1.15);
    expect(opts).toContain(1.33);
    expect(opts.indexOf(1.33)).toBeGreaterThan(opts.indexOf(1.25));
    expect(formatPlaybackRate(1.1)).toBe('1.1×');
    expect(formatPlaybackRate(1.15)).toBe('1.15×');
  });
});
