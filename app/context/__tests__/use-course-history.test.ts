import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useCourseHistory } from '@/app/context/use-course-history';
import type { Course } from '@/app/types';

const MOCK_COURSE: Course = {
  name: 'Test Course',
  modules: [],
  totalLessons: 0,
};

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

afterEach(() => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
  });
});

describe('useCourseHistory', () => {
  it('closes the course on Escape when no overlay or fullscreen is active', () => {
    const closeCourse = vi.fn();
    const cancelAutoAdvance = vi.fn();
    const exitWindowFullscreen = vi.fn();

    renderHook(() =>
      useCourseHistory({
        course: MOCK_COURSE,
        closeCourse,
        autoAdvanceActive: false,
        cancelAutoAdvance,
        windowFullscreen: false,
        exitWindowFullscreen,
      })
    );

    pressEscape();

    expect(closeCourse).toHaveBeenCalledTimes(1);
    expect(exitWindowFullscreen).not.toHaveBeenCalled();
    expect(cancelAutoAdvance).not.toHaveBeenCalled();
  });

  it('exits window fullscreen on Escape without closing the course', () => {
    const closeCourse = vi.fn();
    const cancelAutoAdvance = vi.fn();
    const exitWindowFullscreen = vi.fn();

    renderHook(() =>
      useCourseHistory({
        course: MOCK_COURSE,
        closeCourse,
        autoAdvanceActive: false,
        cancelAutoAdvance,
        windowFullscreen: true,
        exitWindowFullscreen,
      })
    );

    pressEscape();

    expect(exitWindowFullscreen).toHaveBeenCalledTimes(1);
    expect(closeCourse).not.toHaveBeenCalled();
  });

  it('cancels auto-advance before exiting window fullscreen on Escape', () => {
    const closeCourse = vi.fn();
    const cancelAutoAdvance = vi.fn();
    const exitWindowFullscreen = vi.fn();

    renderHook(() =>
      useCourseHistory({
        course: MOCK_COURSE,
        closeCourse,
        autoAdvanceActive: true,
        cancelAutoAdvance,
        windowFullscreen: true,
        exitWindowFullscreen,
      })
    );

    pressEscape();

    expect(cancelAutoAdvance).toHaveBeenCalledTimes(1);
    expect(exitWindowFullscreen).not.toHaveBeenCalled();
    expect(closeCourse).not.toHaveBeenCalled();
  });

  it('ignores Escape while native browser fullscreen is active', () => {
    const closeCourse = vi.fn();
    const exitWindowFullscreen = vi.fn();

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.createElement('div'),
    });

    renderHook(() =>
      useCourseHistory({
        course: MOCK_COURSE,
        closeCourse,
        autoAdvanceActive: false,
        cancelAutoAdvance: vi.fn(),
        windowFullscreen: false,
        exitWindowFullscreen,
      })
    );

    pressEscape();

    expect(closeCourse).not.toHaveBeenCalled();
    expect(exitWindowFullscreen).not.toHaveBeenCalled();
  });

  it('ignores Escape while typing in an input or textarea', () => {
    const closeCourse = vi.fn();
    const exitWindowFullscreen = vi.fn();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    renderHook(() =>
      useCourseHistory({
        course: MOCK_COURSE,
        closeCourse,
        autoAdvanceActive: false,
        cancelAutoAdvance: vi.fn(),
        windowFullscreen: true,
        exitWindowFullscreen,
      })
    );

    pressEscape();

    expect(closeCourse).not.toHaveBeenCalled();
    expect(exitWindowFullscreen).not.toHaveBeenCalled();

    textarea.remove();
  });
});
