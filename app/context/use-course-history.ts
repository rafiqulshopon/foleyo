'use client';

import { useEffect } from 'react';
import type { Course } from '@/app/types';

/**
 * Browser back and Escape close the open course. Escape is ignored while
 * typing in an input or textarea (those consumers handle it themselves).
 */
export function useCourseHistory(
  course: Course | null,
  closeCourse: (isPopState?: boolean) => void
) {
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
        closeCourse();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [course, closeCourse]);
}
