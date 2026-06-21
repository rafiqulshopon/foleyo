'use client';

import { useCourse } from '@/app/context/course-context';
import { useTheme } from '@/app/context/theme-context';
import { useState } from 'react';
import Image from 'next/image';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

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
      className="relative p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className={animating ? 'theme-icon-enter' : ''}>
        {theme === 'dark' ? (
          /* Sun icon */
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
        ) : (
          /* Moon icon */
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
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </div>
    </button>
  );
}

export function Header() {
  const {
    course,
    autoplay,
    sidebarOpen,
    toggleAutoplay,
    toggleSidebar,
    getOverallStats,
    getWatchTimeStats,
    openFolder,
    closeCourse,
  } = useCourse();

  const stats = getOverallStats();
  const watchStats = getWatchTimeStats();

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-surface/80 backdrop-blur-md z-20 shrink-0">
      <div className="flex items-center gap-3">
        {course && (
          <button
            onClick={() => closeCourse()}
            className="flex items-center gap-1.5 pr-3 mr-1 border-r border-border hover:text-foreground text-foreground-subtle transition-colors text-sm font-medium"
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
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground"
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
                  <div className="w-32 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-accent-hover rounded-full transition-all duration-500 ease-out"
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
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-foreground-muted hover:text-foreground"
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

        {/* Theme toggle — always visible */}
        <ThemeToggle />
      </div>
    </header>
  );
}
