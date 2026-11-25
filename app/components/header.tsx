'use client';

import { useCourse } from '@/app/context/course-context';
import { useLessonDurations } from '@/app/context/lesson-durations-context';
import { useTheme } from '@/app/context/theme-context';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { FOCUS_RING } from '@/app/components/focus-ring';
import {
  computeModuleWatchTimeStats,
  computeWatchTimeStats,
  getCompletionStats,
} from '@/app/lib/progress-store';
import {
  getVisibleLessons,
  useLessonOverrides,
} from '@/app/lib/lesson-overrides';
import {
  computeWatchStreakStats,
  estimateFinishDate,
  useWatchHistory,
} from '@/app/lib/watch-history';
import { formatDuration } from '@/app/lib/time';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    setAnimating(true);
    toggleTheme();
    setTimeout(() => setAnimating(false), 400);
  };

  return (
    <button
      onClick={handleToggle}
      suppressHydrationWarning
      className={`relative p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
      aria-label="Toggle color theme"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className={animating ? 'theme-icon-enter' : ''}>
        {/* Both icons are always in the DOM; visibility comes from
            html[data-theme] CSS so hydration markup is identical. */}
        <svg
          className="theme-icon-sun"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <svg
          className="theme-icon-moon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>
    </button>
  );
}

export function Header() {
  const {
    course,
    currentLesson,
    progress,
    autoplay,
    sidebarOpen,
    toggleAutoplay,
    toggleSidebar,
    setActivityOpen,
    setCommandPaletteOpen,
    openFolder,
    closeCourse,
  } = useCourse();
  const { lessonDurations } = useLessonDurations();
  const overrides = useLessonOverrides(course?.name);
  const watchHistory = useWatchHistory();

  const visibleLessons = getVisibleLessons(course, overrides);
  const stats = getCompletionStats(
    progress,
    visibleLessons.map((l) => l.id)
  );
  const watchStats = computeWatchTimeStats(course, progress, lessonDurations);
  const currentModule = course?.modules.find(
    (m) => m.id === currentLesson?.moduleId
  );
  const moduleWatchStats = computeModuleWatchTimeStats(
    currentModule,
    progress,
    lessonDurations,
    overrides.hidden
  );
  const streakStats = useMemo(
    () => computeWatchStreakStats(watchHistory),
    [watchHistory]
  );
  const eta = useMemo(
    () =>
      estimateFinishDate(
        watchStats.remainingSeconds,
        streakStats.averageDailySeconds,
        streakStats.dailyGoalMinutes
      ),
    [
      watchStats.remainingSeconds,
      streakStats.averageDailySeconds,
      streakStats.dailyGoalMinutes,
    ]
  );

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-surface/80 backdrop-blur-md z-20 shrink-0">
      <div className="flex items-center gap-3">
        {course && (
          <button
            onClick={() => closeCourse()}
            className={`flex items-center gap-1.5 pr-3 mr-1 border-r border-border hover:text-foreground text-foreground-subtle transition-colors text-sm font-medium ${FOCUS_RING}`}
            aria-label="Back to all courses"
            title="Back to All Courses"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="hidden sm:inline">All Courses</span>
          </button>
        )}

        {/* Sidebar toggle */}
        {course && (
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {sidebarOpen ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <Image 
              src="/logo.png" 
              alt="Foleyo Logo" 
              fill 
              sizes="28px"
              className="object-contain" 
            />
          </div>
          <span className="font-semibold text-base tracking-tight">
            Foleyo
          </span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Course info & progress */}
        {course && (
          <>
            {/* Progress stats */}
            <div className="hidden sm:flex items-center gap-3 mr-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-32 h-1.5 bg-border rounded-full overflow-hidden"
                    role="progressbar"
                    aria-label="Course completion"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={stats.percentage}
                  >
                    <div
                      className="h-full bg-linear-to-r from-accent to-accent-hover rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-foreground-muted whitespace-nowrap">
                    {stats.completed} / {stats.total} lessons · {stats.percentage}%
                  </span>
                </div>
                {watchStats.totalSeconds > 0 && (
                  <div className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-subtle shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-[11px] text-foreground-subtle whitespace-nowrap">
                      {formatDuration(watchStats.watchedSeconds)} / {formatDuration(watchStats.totalSeconds)}
                      {watchStats.remainingSeconds > 0 && (
                        <span className="text-foreground-muted"> · {formatDuration(watchStats.remainingSeconds)} left</span>
                      )}
                      {moduleWatchStats.remainingSeconds > 0 && (
                        <span className="hidden lg:inline text-foreground-subtle">
                          {' '}· Mod {formatDuration(moduleWatchStats.remainingSeconds)}
                        </span>
                      )}
                      {eta && (
                        <span
                          className="hidden xl:inline text-accent"
                          title={`Estimated finish based on ${eta.paceMinutesPerDay}m/day ${eta.basis === 'average' ? 'average' : 'goal'}`}
                        >
                          {' '}· Est. {eta.label}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Autoplay toggle */}
            <button
              onClick={toggleAutoplay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                autoplay
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-surface-hover text-foreground-muted border border-border'
              }`}
              title={autoplay ? 'Autoplay is on' : 'Autoplay is off'}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {autoplay ? (
                  <>
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    <path d="M22 12 A2 2 0 0 1 22 12" />
                    <path d="M17.5 7.5C19 9 19.5 10.5 19.5 12s-.5 3-2 4.5" />
                  </>
                ) : (
                  <polygon points="5 3 19 12 5 21 5 3" />
                )}
              </svg>
              <span className="hidden md:inline">Autoplay</span>
            </button>

            {/* Open different folder */}
            <button
              onClick={openFolder}
              className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground ${FOCUS_RING}`}
              aria-label="Open different course folder"
              title="Open different course folder"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </>
        )}

        {/* Watch streak & today's watch time pill */}
        <button
          type="button"
          onClick={() => setActivityOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${FOCUS_RING} ${
            streakStats.goalMetToday
              ? 'bg-success/10 border-success/30 text-success hover:bg-success/15'
              : 'bg-surface-hover/60 border-border text-foreground-muted hover:text-foreground hover:bg-surface-hover'
          }`}
          aria-label="Open watch activity and daily streak"
          title={`Watched ${formatDuration(streakStats.todaySeconds)} today · ${streakStats.currentStreak} day streak`}
        >
          <span aria-hidden="true" className="text-[11px]">🔥</span>
          <span>{streakStats.currentStreak}d</span>
          <span className="hidden sm:inline text-foreground-subtle">·</span>
          <span className="hidden sm:inline">
            {streakStats.todayMinutes}m
          </span>
        </button>

        {/* Command palette trigger (⌘K) */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-foreground bg-surface-hover/60 hover:bg-surface-hover border border-border transition-colors ${FOCUS_RING}`}
          aria-label="Open command palette"
          title="Command palette (⌘K / Ctrl+K)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <kbd className="hidden md:inline font-mono text-[10px] text-foreground-subtle">
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle — always visible */}
        <ThemeToggle />
      </div>
    </header>
  );
}
