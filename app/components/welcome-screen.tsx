'use client';

import { useCourse } from '@/app/context/course-context';
import { useEffect, useState, useCallback } from 'react';
import {
  loadRecentCourses,
  removeRecentCourse,
  type RecentCourse,
} from '@/app/lib/recent-courses-store';
import { getCourseThumbnail } from '@/app/lib/thumbnail-generator';

/** Keyboard focus treatment shared by every interactive element. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The label style that structures the whole page — mono, uppercase, tracked out. */
const LABEL =
  'font-mono text-[11px] uppercase tracking-[0.15em] text-foreground-muted';

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

/**
 * "The parse" — a real folder on the left, what Foleyo derives on the right.
 * Values are exactly what parse-course.ts produces: numeric prefixes set the
 * order and are stripped, underscores become spaces, words are capitalized.
 */
const PARSE_ROWS: { disk: string; foleyo: string; note: string; ignored?: boolean }[] = [
  { disk: 'Complete_Web_Dev/', foleyo: 'Complete Web Dev', note: 'course name' },
  { disk: '  01_HTML_Basics/', foleyo: 'Html Basics', note: 'module — the 01_ prefix sets order and is stripped' },
  { disk: '  02_CSS_Styling/', foleyo: 'Css Styling', note: 'module — sorts numerically, so 10_ comes after 2_' },
  { disk: '    01_Intro.mp4', foleyo: 'Intro', note: 'lesson — the prefix sets order' },
  { disk: '    01_Intro.srt', foleyo: 'Subtitles', note: 'auto-loaded — 01_Intro.en.srt becomes an English track' },
  { disk: '    notes.pdf', foleyo: 'Ignored', note: 'anything that is not video or .srt/.vtt', ignored: true },
];

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className={`${LABEL} font-medium`}>{label}</h2>
      {meta && <span className={`${LABEL} text-right`}>{meta}</span>}
    </div>
  );
}

function CourseThumb({ courseId, initials }: { courseId: string; initials: string }) {
  const [thumbnail, setThumbnail] = useState<string | null | 'generating'>(null);

  useEffect(() => {
    getCourseThumbnail(courseId).then(setThumbnail);

    const handleGen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.courseId === courseId) {
        setThumbnail('generating');
      }
    };

    const handleReady = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.courseId === courseId) {
        setThumbnail(customEvent.detail.thumbnail || null);
      }
    };

    window.addEventListener('foleyo-thumbnail-generating', handleGen);
    window.addEventListener('foleyo-thumbnail-ready', handleReady);
    return () => {
      window.removeEventListener('foleyo-thumbnail-generating', handleGen);
      window.removeEventListener('foleyo-thumbnail-ready', handleReady);
    };
  }, [courseId]);

  // Same footprint in every state — no layout shift while thumbnails load.
  const box = 'h-[45px] w-20 shrink-0 overflow-hidden rounded-md sm:h-14 sm:w-24';

  if (thumbnail === 'generating') {
    return <div className={`${box} animate-pulse bg-surface-hover`} />;
  }

  if (thumbnail) {
    return (
      <div className={`${box} bg-black`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${box} flex items-center justify-center bg-surface-active`}>
      <span className="font-mono text-[10px] font-medium tracking-wide text-foreground-muted">
        {initials}
      </span>
    </div>
  );
}

function LibraryRow({
  course,
  index,
  onResume,
  onRemove,
}: {
  course: RecentCourse;
  index: number;
  onResume: () => void;
  onRemove: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setRemoving(true);
      setTimeout(() => onRemove(), 300);
    },
    [onRemove]
  );

  const complete = course.percentage === 100;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${course.name} — resume`}
      onClick={onResume}
      onKeyDown={(e) => {
        // Let inner controls (the remove button) handle their own keys.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onResume();
        }
      }}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`recent-row group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-hover sm:gap-4 sm:px-3 ${FOCUS_RING} ${
        removing ? 'animate-card-remove' : ''
      }`}
    >
      <CourseThumb courseId={course.name} initials={getInitials(course.name)} />

      {/* Name + last lesson */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium leading-tight text-foreground">
          {course.name}
        </h3>
        {course.lastLessonTitle && (
          <p className="mt-1 truncate text-xs leading-tight text-foreground-muted">
            {course.lastLessonModule && (
              <span className="text-foreground-muted">{course.lastLessonModule} › </span>
            )}
            {course.lastLessonTitle}
          </p>
        )}
        {/* Compact meta on small screens, where the progress block is hidden */}
        <p className="mt-1 font-mono text-[11px] leading-tight text-foreground-muted sm:hidden">
          {course.completedLessons} / {course.totalLessons} · {course.percentage}%
        </p>
      </div>

      {/* Progress block — mono numbers, thin bar */}
      <div className="hidden w-36 shrink-0 flex-col items-end gap-1.5 sm:flex">
        <span className="font-mono text-[11px] leading-none text-foreground-muted">
          {course.completedLessons} / {course.totalLessons} · {course.percentage}%
        </span>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              complete ? 'bg-success' : 'bg-accent'
            }`}
            style={{ width: `${Math.max(course.percentage, 0)}%` }}
          />
        </div>
        {/* Time crossfades into the resume affordance on hover / focus */}
        <div className="relative h-4 w-28">
          <span className="absolute inset-0 text-right font-mono text-[11px] leading-4 text-foreground-muted transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0">
            {timeAgo(course.lastOpenedAt)}
          </span>
          <span className="absolute inset-0 text-right font-mono text-[11px] font-medium leading-4 text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            Resume →
          </span>
        </div>
      </div>

      {/* Remove — revealed on hover and whenever the row has focus within */}
      <button
        onClick={handleRemove}
        aria-label="Remove from library"
        title="Remove from library"
        className={`shrink-0 rounded-md p-1.5 text-foreground-subtle opacity-0 transition-opacity hover:bg-surface-active hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 ${FOCUS_RING}`}
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
  );
}

function HowItWorks() {
  return (
    <section className="mt-14 border-t border-border-subtle pt-10">
      <SectionLabel label="How it works" meta="Nothing copied · Nothing uploaded" />

      <div className="mt-6">
        {/* Column headers */}
        <div className="hidden gap-8 border-b border-border-subtle pb-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <span className={LABEL}>Your disk</span>
          <span />
          <span className={LABEL}>In Foleyo</span>
        </div>

        <div className="mt-2">
          {PARSE_ROWS.map((row, i) => (
            <div
              key={row.disk.trim()}
              className="diagram-row grid grid-cols-1 gap-x-8 py-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <code className="whitespace-pre pl-1 font-mono text-[13px] leading-6 text-foreground-muted">
                {row.disk}
              </code>
              <span
                aria-hidden="true"
                className="hidden self-center font-mono text-[13px] text-foreground-subtle sm:block"
              >
                →
              </span>
              <p className="pl-6 font-mono text-[13px] leading-6 sm:pl-0">
                <span
                  className={
                    row.ignored ? 'text-foreground-subtle' : 'text-foreground'
                  }
                >
                  {row.foleyo}
                </span>
                <span className="text-foreground-muted"> — {row.note}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] leading-none text-foreground-muted">
      {children}
    </kbd>
  );
}

function Shortcut({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-foreground-muted">
      <span className="flex gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      <span>{action}</span>
    </div>
  );
}

function Reference() {
  return (
    <section className="mt-14 border-t border-border-subtle pt-10">
      <SectionLabel label="Reference" />

      <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
        {/* Formats */}
        <div className="md:border-l md:border-border-subtle md:pl-8 md:first:border-l-0 md:first:pl-0">
          <h3 className={`${LABEL} font-medium`}>Formats</h3>
          <p className="mt-3 font-mono text-[11px] leading-none text-foreground-muted">Video</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {['.mp4', '.mkv', '.webm', '.mov', '.ts'].map((ext) => (
              <span
                key={ext}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1 font-mono text-[11px] text-foreground-muted"
              >
                {ext}
              </span>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] leading-none text-foreground-muted">Subtitles</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {['.srt', '.vtt'].map((ext) => (
              <span
                key={ext}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1 font-mono text-[11px] text-foreground-muted"
              >
                {ext}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
            MKV and TS depend on the codecs inside — H.264 in an MP4 plays everywhere.
          </p>
        </div>

        {/* Local by design */}
        <div className="md:border-l md:border-border-subtle md:pl-8">
          <h3 className={`${LABEL} font-medium`}>Local by design</h3>
          <ul className="mt-3 space-y-2.5">
            {[
              ['No uploads', ' — files stream straight from your disk.'],
              ['No account', ' — progress lives in this browser.'],
              ['No network', ' — works on a plane.'],
            ].map(([lead, rest]) => (
              <li key={lead} className="text-sm leading-relaxed">
                <span className="text-foreground">{lead}</span>
                <span className="text-foreground-muted">{rest}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Shortcuts */}
        <div className="md:border-l md:border-border-subtle md:pl-8">
          <h3 className={`${LABEL} font-medium`}>Shortcuts</h3>
          <div className="mt-3 space-y-2">
            <Shortcut keys={['Space', 'K']} action="play / pause" />
            <Shortcut keys={['←', '→']} action="seek 5s" />
            <Shortcut keys={['↑', '↓']} action="volume" />
            <Shortcut keys={['M', 'F']} action="mute · fullscreen" />
            <Shortcut keys={['C', 'I']} action="captions · PiP" />
            <Shortcut keys={['<', '>']} action="speed down / up" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-foreground-muted">
            When the player has focus.
          </p>
        </div>
      </div>

      <p className="mt-12 font-mono text-[11px] text-foreground-muted">
        Foleyo needs Chrome or Edge on desktop — the File System Access API is Chromium-only.
      </p>
    </section>
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

  // Library summary for the section meta: "6 COURSES · 214/540 LESSONS · 61%"
  const totals = recentCourses.reduce(
    (acc, c) => ({
      completed: acc.completed + c.completedLessons,
      total: acc.total + c.totalLessons,
    }),
    { completed: 0, total: 0 }
  );
  const libraryMeta = `${recentCourses.length} ${
    recentCourses.length === 1 ? 'course' : 'courses'
  } · ${totals.completed}/${totals.total} lessons · ${
    totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0
  }%`;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl animate-fade-in px-5 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
        {/* Intro */}
        <header>
          <p className={LABEL}>Runs entirely on this machine</p>
          <h1 className="mt-4 max-w-2xl text-balance text-3xl font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Turn a folder of videos into a course.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-foreground-muted">
            Foleyo reads a course folder straight off your disk — modules, lessons,
            subtitles — and tracks your progress as you watch. Nothing uploads. It
            works offline.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={openFolder}
              disabled={isLoading}
              className={`inline-flex items-center gap-2.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-50 ${FOCUS_RING}`}
            >
              {isLoading && !resumingFolder ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Loading course…
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Open course folder
                </>
              )}
            </button>
            {hasRecent && (
              <span className="font-mono text-[11px] text-foreground-muted">or resume below</span>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 max-w-xl border-l-2 border-danger bg-danger/10 px-4 py-2.5 text-sm leading-relaxed text-danger"
            >
              {error}
            </div>
          )}
        </header>

        {loadingRecent ? (
          <p
            className={`${LABEL} mt-14 animate-pulse border-t border-border-subtle pt-10`}
          >
            Loading…
          </p>
        ) : (
          <>
            {/* Library */}
            {hasRecent && (
              <section className="mt-14 border-t border-border-subtle pt-10">
                <SectionLabel label="Library" meta={libraryMeta} />
                <div className="mt-4 divide-y divide-border-subtle">
                  {recentCourses.map((course, i) => (
                    <div key={course.folderName} className="relative">
                      {resumingFolder === course.folderName && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
                          <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
                            <Spinner className="h-3.5 w-3.5 text-accent" />
                            Resuming…
                          </div>
                        </div>
                      )}
                      <LibraryRow
                        course={course}
                        index={i}
                        onResume={() => handleResume(course)}
                        onRemove={() => handleRemove(course.folderName)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <HowItWorks />
            <Reference />
          </>
        )}
      </div>
    </div>
  );
}
