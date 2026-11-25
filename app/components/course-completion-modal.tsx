'use client';

import { useEffect, useMemo } from 'react';
import { useCourse } from '@/app/context/course-context';
import { useLessonDurations } from '@/app/context/lesson-durations-context';
import { computeWatchTimeStats } from '@/app/lib/progress-store';
import { computeWatchStreakStats, useWatchHistory } from '@/app/lib/watch-history';
import { useCourseNotes } from '@/app/lib/use-notes';
import { useCourseBookmarks } from '@/app/lib/bookmarks';
import { getVisibleLessons, useLessonOverrides } from '@/app/lib/lesson-overrides';
import { formatDuration } from '@/app/lib/time';
import { FOCUS_RING } from '@/app/components/focus-ring';

const CONFETTI_PIECES = [
  { left: '10%', delay: '0ms', color: 'bg-accent' },
  { left: '22%', delay: '120ms', color: 'bg-success' },
  { left: '35%', delay: '60ms', color: 'bg-warning' },
  { left: '48%', delay: '180ms', color: 'bg-accent-hover' },
  { left: '62%', delay: '90ms', color: 'bg-success' },
  { left: '75%', delay: '150ms', color: 'bg-warning' },
  { left: '88%', delay: '40ms', color: 'bg-accent' },
];

export function CourseCompletionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { course, progress, closeCourse } = useCourse();
  const { lessonDurations } = useLessonDurations();
  const overrides = useLessonOverrides(course?.name);
  const courseNotes = useCourseNotes(course?.name);
  const courseBookmarks = useCourseBookmarks(course?.name);
  const watchHistory = useWatchHistory();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const visibleLessons = useMemo(
    () => getVisibleLessons(course, overrides),
    [course, overrides],
  );
  const watchStats = useMemo(
    () => computeWatchTimeStats(course, progress, lessonDurations),
    [course, progress, lessonDurations],
  );
  const streakStats = useMemo(
    () => computeWatchStreakStats(watchHistory),
    [watchHistory],
  );

  const notesCount = useMemo(
    () =>
      Object.values(courseNotes).filter((text) => text.trim().length > 0).length,
    [courseNotes],
  );
  const bookmarksCount = useMemo(
    () =>
      Object.values(courseBookmarks).reduce((sum, list) => sum + list.length, 0),
    [courseBookmarks],
  );

  if (!open || !course) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Course completed: ${course.name}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle confetti particles */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden"
          aria-hidden="true"
        >
          {CONFETTI_PIECES.map((piece, idx) => (
            <span
              key={idx}
              style={{ left: piece.left, animationDelay: piece.delay }}
              className={`confetti-piece absolute top-0 w-2 h-2 rounded-xs opacity-80 ${piece.color}`}
            />
          ))}
        </div>

        {/* Trophy icon */}
        <div className="relative flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center text-success mb-4">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-success font-medium">
            Course Complete
          </p>
          <h2 className="mt-1.5 text-xl font-semibold text-foreground text-balance">
            {course.name}
          </h2>
          <p className="mt-1 text-xs text-foreground-muted">
            You finished every lesson in this course. Great work!
          </p>
        </div>

        {/* Summary stats grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatTile
            value={String(visibleLessons.length)}
            label={visibleLessons.length === 1 ? 'Lesson' : 'Lessons'}
          />
          <StatTile
            value={String(course.modules.length)}
            label={course.modules.length === 1 ? 'Module' : 'Modules'}
          />
          <StatTile
            value={
              watchStats.totalSeconds > 0
                ? formatDuration(watchStats.totalSeconds)
                : '100%'
            }
            label={watchStats.totalSeconds > 0 ? 'Total length' : 'Completed'}
          />
          <StatTile
            value={
              streakStats.currentStreak > 0
                ? `${streakStats.currentStreak}d`
                : `${notesCount + bookmarksCount}`
            }
            label={
              streakStats.currentStreak > 0
                ? 'Day streak'
                : 'Notes & marks'
            }
          />
        </div>

        {(notesCount > 0 || bookmarksCount > 0 || streakStats.todaySeconds > 0) && (
          <div className="mt-3 rounded-xl bg-background/60 border border-border-subtle px-3.5 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-mono text-foreground-muted">
            {streakStats.todaySeconds > 0 && (
              <span>Watched {formatDuration(streakStats.todaySeconds)} today</span>
            )}
            {notesCount > 0 && (
              <span>
                {notesCount} {notesCount === 1 ? 'note' : 'notes'}
              </span>
            )}
            {bookmarksCount > 0 && (
              <span>
                {bookmarksCount}{' '}
                {bookmarksCount === 1 ? 'bookmark' : 'bookmarks'}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-medium bg-surface-hover hover:bg-surface-active text-foreground border border-border transition-colors ${FOCUS_RING}`}
          >
            Stay &amp; review
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              closeCourse();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors ${FOCUS_RING}`}
          >
            Back to All Courses
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border-subtle px-3 py-2.5 text-center">
      <div className="font-mono text-base font-semibold text-foreground">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground-subtle">
        {label}
      </div>
    </div>
  );
}
