'use client';

import { useEffect } from 'react';
import type { Course } from '@/app/types';

interface UseCourseHistoryOptions {
  course: Course | null;
  closeCourse: (isPopState?: boolean) => void;
  /** True while an auto-advance countdown is pending. */
  autoAdvanceActive: boolean;
  cancelAutoAdvance: () => void;
  /** True while the player is expanded to fill the browser window. */
  windowFullscreen: boolean;
  exitWindowFullscreen: () => void;
}

/**
 * Browser back and Escape close the open course. Escape is ignored while
 * typing in an input or textarea (those consumers handle it themselves) or
 * while native browser fullscreen is active. Otherwise Escape unwinds layers
 * from innermost to outermost: pending auto-advance countdown → window
 * fullscreen → close course.
 */
export function useCourseHistory({
  course,
  closeCourse,
  autoAdvanceActive,
  cancelAutoAdvance,
  windowFullscreen,
  exitWindowFullscreen,
}: UseCourseHistoryOptions) {
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state?.isCourseOpen && course) {
        closeCourse(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && course) {
        if (
          ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')
        )
          return;
        if (document.fullscreenElement) return;
        if (autoAdvanceActive) {
          cancelAutoAdvance();
          return;
        }
        if (windowFullscreen) {
          exitWindowFullscreen();
          return;
        }
        closeCourse();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    course,
    closeCourse,
    autoAdvanceActive,
    cancelAutoAdvance,
    windowFullscreen,
    exitWindowFullscreen,
  ]);
}
