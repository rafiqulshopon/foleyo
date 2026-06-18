'use client';

import { useCourse } from '@/app/context/course-context';

export function Header() {
  const {
    course,
    autoplay,
    sidebarOpen,
    toggleAutoplay,
    toggleSidebar,
    getOverallStats,
    openFolder,
  } = useCourse();

  const stats = getOverallStats();

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-surface/80 backdrop-blur-md z-20 shrink-0">
      <div className="flex items-center gap-3">
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
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-purple-400 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="white"
              className="drop-shadow-sm"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight">
            Foleyo
          </span>
        </div>
      </div>

      {/* Course info & progress */}
      {course && (
        <div className="flex items-center gap-2">
          {/* Progress stats */}
          <div className="hidden sm:flex items-center gap-3 mr-3">
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
        </div>
      )}
    </header>
  );
}
