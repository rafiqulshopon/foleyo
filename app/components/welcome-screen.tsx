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
    <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
      <div
        className={`w-full animate-fade-in ${hasRecent ? 'max-w-2xl' : 'max-w-4xl'}`}
      >
        {/* Header section */}
        <div className="text-center mb-10 relative">
          {/* Subtle background glow for empty state */}
          {!hasRecent && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-accent/5 blur-[120px] rounded-[100%] pointer-events-none -z-10" />
          )}
          
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative w-28 h-28 flex items-center justify-center drop-shadow-2xl hover:scale-105 transition-transform duration-500">
              <Image 
                src="/logo.png" 
                alt="Foleyo Logo" 
                fill 
                sizes="112px"
                className="object-contain" 
                priority
              />
            </div>
          </div>

          <h1 className={`font-bold text-foreground mb-4 tracking-tight ${hasRecent ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'}`}>
            {hasRecent ? 'Continue Learning' : 'Your Premium Offline Learning Experience'}
          </h1>
          <p className={`text-foreground-muted mx-auto leading-relaxed ${hasRecent ? 'text-sm sm:text-base max-w-md' : 'text-lg sm:text-xl max-w-2xl'}`}>
            {hasRecent
              ? 'Pick up where you left off or open a new course folder.'
              : 'Load any massive video course from your computer and start learning with a beautiful, distraction-free interface.'}
          </p>
        </div>

        {/* Open folder button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={openFolder}
            disabled={isLoading}
            className={`group relative inline-flex items-center gap-3 font-semibold rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100 ${
              hasRecent
                ? 'px-5 py-3 text-sm bg-surface border border-border text-foreground hover:border-accent/50 hover:bg-surface-hover shadow-none'
                : 'px-10 py-5 text-lg bg-gradient-to-r from-accent to-accent-hover text-white shadow-accent/25 hover:shadow-accent/40 ring-1 ring-white/10'
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading course...
              </>
            ) : (
              <>
                <svg
                  width={hasRecent ? "20" : "24"}
                  height={hasRecent ? "20" : "24"}
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
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent to-accent-hover opacity-0 group-hover:opacity-30 blur-2xl transition-opacity duration-500 -z-10" />
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
          /* Modern Features Grid & Folder Hint */
          <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Feature 1 */}
              <div className="bg-surface/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm flex flex-col items-center text-center hover:bg-surface hover:border-border transition-colors">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground mb-2">100% Local & Private</h3>
                <p className="text-sm text-foreground-subtle leading-relaxed">No uploads. Streams multi-gigabyte courses instantly directly from your hard drive.</p>
              </div>

              {/* Feature 2 */}
              <div className="bg-surface/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm flex flex-col items-center text-center hover:bg-surface hover:border-border transition-colors">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Progress Tracking</h3>
                <p className="text-sm text-foreground-subtle leading-relaxed">Never lose your place. Foleyo automatically tracks your completed lessons and remembers your exact timestamp.</p>
              </div>

              {/* Feature 3 */}
              <div className="bg-surface/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm flex flex-col items-center text-center hover:bg-surface hover:border-border transition-colors">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Integrated Notes</h3>
                <p className="text-sm text-foreground-subtle leading-relaxed">Take distraction-free Markdown notes side-by-side with your video. Export to .md anytime.</p>
              </div>

              {/* Feature 4 */}
              <div className="bg-surface/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm flex flex-col items-center text-center hover:bg-surface hover:border-border transition-colors">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Universal Playback</h3>
                <p className="text-sm text-foreground-subtle leading-relaxed">Supports standard web media formats including .mp4, .webm, and .mkv with automatic subtitle detection.</p>
              </div>
            </div>

            {/* Folder structure hint - moved below features */}
            <div className="bg-surface rounded-2xl border border-border p-6 mt-8 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Expected Folder Structure
                </h3>
                <p className="text-sm text-foreground-subtle leading-relaxed mb-4">
                  Organize your course folder simply. Any subfolders are treated as modules, and the video files inside them become lessons. Foleyo automatically builds a Netflix-like sidebar for you.
                </p>
              </div>
              <div className="bg-background rounded-xl border border-border/50 p-4 font-mono text-[11px] text-foreground-subtle w-full sm:w-auto shadow-inner">
                <div className="text-foreground-muted">📁 Complete_Web_Dev/</div>
                <div className="ml-4 text-foreground-subtle">📁 01_HTML_Basics/</div>
                <div className="ml-8 text-accent/70">🎬 01_Intro.mp4</div>
                <div className="ml-8 text-accent/70">🎬 02_Elements.mp4</div>
                <div className="ml-4 text-foreground-subtle">📁 02_CSS_Styling/</div>
                <div className="ml-8 text-accent/70">🎬 01_Selectors.mp4</div>
              </div>
            </div>
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
