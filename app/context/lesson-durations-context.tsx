'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface LessonDurationsContextType {
  lessonDurations: Record<string, number>;
  setLessonDuration: (lessonId: string, duration: number) => void;
}

const LessonDurationsContext = createContext<LessonDurationsContextType | null>(
  null
);

/**
 * Lesson durations live in their own tiny context so background-scan batches
 * (and the player's metadata reports) don't invalidate the main course
 * context's memoized value. Consumers: header (watch-time stats), video
 * player (reports durations).
 */
export function LessonDurationsProvider({
  lessonDurations,
  setLessonDuration,
  children,
}: LessonDurationsContextType & { children: ReactNode }) {
  const value = useMemo(
    () => ({ lessonDurations, setLessonDuration }),
    [lessonDurations, setLessonDuration]
  );

  return (
    <LessonDurationsContext.Provider value={value}>
      {children}
    </LessonDurationsContext.Provider>
  );
}

export function useLessonDurations() {
  const ctx = useContext(LessonDurationsContext);
  if (!ctx)
    throw new Error(
      'useLessonDurations must be used within LessonDurationsProvider'
    );
  return ctx;
}
