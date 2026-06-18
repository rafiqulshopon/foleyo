'use client';

import { useCourse } from '@/app/context/course-context';

export function WelcomeScreen() {
  const { openFolder, isLoading, error } = useCourse();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-accent/30">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="white"
              className="drop-shadow-md"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
          Welcome to Foleyo
        </h1>
        <p className="text-foreground-muted mb-8 text-base leading-relaxed">
          Your offline course player. Load a course folder from your computer
          and start learning with a beautiful, distraction-free interface.
        </p>

        {/* Open folder button */}
        <button
          onClick={openFolder}
          disabled={isLoading}
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-accent to-accent-hover text-white font-semibold rounded-2xl shadow-xl shadow-accent/25 hover:shadow-accent/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading course...
            </>
          ) : (
            <>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <polyline points="9 14 12 11 15 14" />
              </svg>
              Open Course Folder
            </>
          )}

          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent to-accent-hover opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
        </button>

        {/* Error display */}
        {error && (
          <div className="mt-6 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm text-left">
            <div className="flex items-start gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Folder structure hint */}
        <div className="mt-10 text-left bg-surface rounded-xl border border-border p-5">
          <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
            Expected folder structure
          </h3>
          <div className="font-mono text-xs text-foreground-subtle space-y-1">
            <div className="text-foreground-muted">📁 MyCourse/</div>
            <div className="ml-5 text-foreground-subtle">📁 01_Introduction/</div>
            <div className="ml-10 text-accent/70">🎬 01_Welcome.mp4</div>
            <div className="ml-10 text-accent/70">🎬 02_Setup.mp4</div>
            <div className="ml-5 text-foreground-subtle">📁 02_Core_Concepts/</div>
            <div className="ml-10 text-accent/70">🎬 01_Basics.mp4</div>
            <div className="ml-10 text-accent/70">🎬 02_Advanced.mp4</div>
          </div>
          <p className="text-[11px] text-foreground-subtle mt-3 leading-relaxed">
            Subfolders are treated as modules, video files inside as lessons.
            Supports <span className="text-foreground-muted">.mp4</span>,{' '}
            <span className="text-foreground-muted">.webm</span>,{' '}
            <span className="text-foreground-muted">.mov</span>, and{' '}
            <span className="text-foreground-muted">.mkv</span> files.
          </p>
        </div>

        {/* Browser support note */}
        <p className="mt-6 text-xs text-foreground-subtle">
          Works on Chrome and Edge. Requires File System Access API support.
        </p>
      </div>
    </div>
  );
}
