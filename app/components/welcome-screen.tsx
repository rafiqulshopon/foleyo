'use client';

import { useCourse } from '@/app/context/course-context';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  loadRecentCourses,
  removeRecentCourse,
  type RecentCourse,
} from '@/app/lib/recent-courses-store';
import { getCourseThumbnail } from '@/app/lib/thumbnail-generator';

/**
 * Format a timestamp into a human-readable relative time string.
 */
function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  }
  if (seconds < 86400) {
    const hrs = Math.floor(seconds / 3600);
    return `${hrs}h ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days}d ago`;
  }
  if (seconds < 2592000) {
    const weeks = Math.floor(seconds / 604800);
    return `${weeks}w ago`;
  }
  const months = Math.floor(seconds / 2592000);
  return `${months}mo ago`;
}

/**
 * Generate a deterministic gradient based on the course name.
 */
function getCourseGradient(name: string): string {
  const gradients = [
    'from-violet-600 to-indigo-600',
    'from-blue-600 to-cyan-500',
    'from-emerald-600 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-rose-600 to-pink-500',
    'from-fuchsia-600 to-purple-500',
    'from-sky-500 to-blue-600',
    'from-lime-500 to-emerald-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

/**
 * Get initials from a course name (max 2 chars).
 */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function RecentCourseCard({
  course,
  onResume,
  onRemove,
  index,
}: {
  course: RecentCourse;
  onResume: () => void;
  onRemove: () => void;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null | 'generating'>(null);

  useEffect(() => {
    getCourseThumbnail(course.name).then(setThumbnail);

    const handleGen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.courseId === course.name) {
        setThumbnail('generating');
      }
    };

    const handleReady = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.courseId === course.name) {
        setThumbnail(customEvent.detail.thumbnail || null);
      }
    };

    window.addEventListener('foleyo-thumbnail-generating', handleGen);
    window.addEventListener('foleyo-thumbnail-ready', handleReady);
    return () => {
      window.removeEventListener('foleyo-thumbnail-generating', handleGen);
      window.removeEventListener('foleyo-thumbnail-ready', handleReady);
    };
  }, [course.name]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setRemoving(true);
      setTimeout(() => onRemove(), 300);
    },
    [onRemove]
  );

  const gradient = getCourseGradient(course.name);
  const initials = getInitials(course.name);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onResume}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onResume(); } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`recent-card group relative w-full text-left rounded-2xl border border-border bg-surface hover:bg-surface-hover transition-all duration-300 overflow-hidden cursor-pointer ${
        removing ? 'animate-card-remove' : ''
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top thumbnail / gradient banner */}
      {thumbnail === 'generating' ? (
        <div className="w-full h-28 bg-surface-hover animate-pulse" />
      ) : thumbnail ? (
        <div className="w-full h-28 bg-black relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      ) : (
        <div className={`h-1 w-full bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />
      )}

      <div className="p-4">
        {/* Top row: avatar + meta */}
        <div className="flex items-start gap-3">
          {/* Course avatar */}
          {thumbnail && thumbnail !== 'generating' ? null : (
            <div
              className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
            >
              <span className="text-white font-bold text-sm tracking-tight">
                {initials}
              </span>
            </div>
          )}

          {/* Course info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
              {course.name}
            </h3>
            <p className="text-xs text-foreground-subtle mt-0.5">
              {course.totalModules} module{course.totalModules !== 1 ? 's' : ''}{' '}
              · {course.totalLessons} lesson
              {course.totalLessons !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Remove button */}
          <button
            onClick={handleRemove}
            className="shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-active text-foreground-subtle hover:text-danger transition-all duration-200"
            title="Remove from recent"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-foreground-muted">
              {course.completedLessons} / {course.totalLessons} completed
            </span>
            <span
              className={`text-[11px] font-medium ${
                course.percentage === 100
                  ? 'text-success'
                  : course.percentage > 0
                    ? 'text-accent'
                    : 'text-foreground-subtle'
              }`}
            >
              {course.percentage}%
            </span>
          </div>
          <div className="h-1.5 bg-border/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                course.percentage === 100
                  ? 'bg-success'
                  : 'bg-gradient-to-r from-accent to-accent-hover'
              }`}
              style={{ width: `${Math.max(course.percentage, 0)}%` }}
            />
          </div>
        </div>

        {/* Last lesson info */}
        {course.lastLessonTitle && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-foreground-subtle">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-foreground-subtle"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span className="truncate">
              {course.lastLessonModule && (
                <span className="text-foreground-muted">
                  {course.lastLessonModule} ›{' '}
                </span>
              )}
              {course.lastLessonTitle}
            </span>
          </div>
        )}

        {/* Bottom row: time + resume hint */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-foreground-subtle">
            {timeAgo(course.lastOpenedAt)}
          </span>

          {/* Resume indicator */}
          <div
            className={`flex items-center gap-1 text-[11px] font-medium text-accent transition-all duration-200 ${
              isHovered
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-2'
            }`}
          >
            <span>Resume</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen() {
  const { openFolder, resumeRecentCourse, isLoading, error } = useCourse();
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [resumingFolder, setResumingFolder] = useState<string | null>(null);

  // Load recent courses from IndexedDB on mount
  useEffect(() => {
    loadRecentCourses().then((courses) => {
      setRecentCourses(courses);
      setLoadingRecent(false);
    });
  }, []);

  const handleResume = useCallback(
    async (course: RecentCourse) => {
      setResumingFolder(course.folderName);
      await resumeRecentCourse(course.folderName);
      setResumingFolder(null);
    },
    [resumeRecentCourse]
  );

  const handleRemove = useCallback(async (folderName: string) => {
    await removeRecentCourse(folderName);
    setRecentCourses((prev) => prev.filter((c) => c.folderName !== folderName));
  }, []);

  const hasRecent = recentCourses.length > 0;

  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-8 overflow-y-auto">
      <div
        className={`w-full animate-fade-in ${hasRecent ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        {/* Header section */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <div className="relative w-24 h-24 flex items-center justify-center drop-shadow-2xl hover:scale-105 transition-transform duration-300">
              <Image 
                src="/logo.png" 
                alt="Foleyo Logo" 
                fill 
                sizes="96px"
                className="object-contain" 
                priority
              />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {hasRecent ? 'Continue Learning' : 'Welcome to Foleyo'}
          </h1>
          <p className="text-foreground-muted text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            {hasRecent
              ? 'Pick up where you left off or open a new course folder.'
              : 'Your offline course player. Load a course folder from your computer and start learning with a beautiful, distraction-free interface.'}
          </p>
        </div>

        {/* Open folder button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={openFolder}
            disabled={isLoading}
            className={`group relative inline-flex items-center gap-2.5 font-semibold rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100 ${
              hasRecent
                ? 'px-5 py-3 text-sm bg-surface border border-border text-foreground hover:border-accent/50 hover:bg-surface-hover shadow-none'
                : 'px-8 py-4 bg-gradient-to-r from-accent to-accent-hover text-white shadow-accent/25 hover:shadow-accent/40'
            }`}
          >
            {isLoading && !resumingFolder ? (
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
                  width="20"
                  height="20"
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
                {hasRecent ? 'Open New Course' : 'Open Course Folder'}
              </>
            )}

            {/* Glow effect — only on the primary variant */}
            {!hasRecent && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent to-accent-hover opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
            )}
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-8 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm text-left max-w-md mx-auto">
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

        {/* Recent courses section */}
        {loadingRecent ? (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-2 text-foreground-subtle text-sm">
              <svg
                className="animate-spin h-4 w-4"
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
              Loading...
            </div>
          </div>
        ) : hasRecent ? (
          <div className="animate-fade-in">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-4">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground-muted"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Recently Played
              </h2>
            </div>

            {/* Course cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentCourses.map((course, i) => (
                <div key={course.folderName} className="relative">
                  {/* Loading overlay when resuming this specific course */}
                  {resumingFolder === course.folderName && (
                    <div className="absolute inset-0 z-10 rounded-2xl bg-surface/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex items-center gap-2 text-accent text-sm font-medium">
                        <svg
                          className="animate-spin h-4 w-4"
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
                        Resuming...
                      </div>
                    </div>
                  )}
                  <RecentCourseCard
                    course={course}
                    onResume={() => handleResume(course)}
                    onRemove={() => handleRemove(course.folderName)}
                    index={i}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Folder structure hint — only show when no recent courses */
          <div className="text-left bg-surface rounded-xl border border-border p-5 max-w-md mx-auto">
            <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
              Expected folder structure
            </h3>
            <div className="font-mono text-xs text-foreground-subtle space-y-1">
              <div className="text-foreground-muted">📁 MyCourse/</div>
              <div className="ml-5 text-foreground-subtle">
                📁 01_Introduction/
              </div>
              <div className="ml-10 text-accent/70">🎬 01_Welcome.mp4</div>
              <div className="ml-10 text-accent/70">🎬 02_Setup.mp4</div>
              <div className="ml-5 text-foreground-subtle">
                📁 02_Core_Concepts/
              </div>
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
        )}

        {/* Browser support note */}
        <p className="mt-6 text-xs text-foreground-subtle text-center">
          Works on Chrome and Edge. Requires File System Access API support.
        </p>
      </div>
    </div>
  );
}
