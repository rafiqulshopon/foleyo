'use client';

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  findActiveCueIndex,
  searchSubtitleCues,
  readSubtitleCues,
  dedupeSubtitles,
  pickDefaultSubtitle,
  readCaptionPreference,
  type SubtitleCue,
} from '@/app/lib/subtitles';
import { formatTimestamp } from '@/app/lib/time';
import { getDisplayTitle, type LessonOverrides } from '@/app/lib/lesson-overrides';
import type { SubtitleTrack } from '@/app/context/course-context';
import type { Course, Lesson } from '@/app/types';
import { FOCUS_RING } from '@/app/components/focus-ring';

interface CourseSubtitleMatch {
  lesson: Lesson;
  moduleTitle: string;
  cue: SubtitleCue;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return <>{text}</>;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = terms.some(
          (t) => part.toLowerCase() === t.toLowerCase(),
        );
        return isMatch ? (
          <mark
            key={idx}
            className="bg-accent/25 text-foreground rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        );
      })}
    </>
  );
}

export function TranscriptPanel({
  tracks,
  currentTime,
  onSeek,
  onClose,
  course,
  currentLesson,
  lessonOverrides,
  onJumpToLessonCue,
}: {
  tracks: SubtitleTrack[];
  currentTime: number;
  onSeek: (time: number) => void;
  onClose: () => void;
  course: Course | null;
  currentLesson: Lesson | null;
  lessonOverrides: LessonOverrides;
  onJumpToLessonCue: (lesson: Lesson, time: number) => void;
}) {
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'lesson' | 'course'>('lesson');
  const [autoScroll, setAutoScroll] = useState(true);
  const [userScrolledAway, setUserScrolledAway] = useState(false);

  // Cross-lesson subtitle search cache (loaded on-demand when scope === 'course')
  const [courseCuesState, setCourseCuesState] = useState<{
    courseName: string;
    entries: { lesson: Lesson; moduleTitle: string; cues: SubtitleCue[] }[];
  } | null>(null);
  const [indexingCourse, setIndexingCourse] = useState(false);

  const courseCues =
    course && courseCuesState?.courseName === course.name
      ? courseCuesState.entries
      : null;

  const listRef = useRef<HTMLDivElement>(null);
  const activeCueRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const programmaticScrollRef = useRef(false);

  // Pick active track: user's chosen language if available, else default caption track, else first track
  const activeTrack = useMemo(() => {
    if (tracks.length === 0) return null;
    if (selectedLang) {
      const found = tracks.find((t) => t.language === selectedLang);
      if (found) return found;
    }
    const prefLang = pickDefaultSubtitle(tracks, readCaptionPreference());
    if (prefLang) {
      const found = tracks.find((t) => t.language === prefLang);
      if (found) return found;
    }
    return tracks[0];
  }, [tracks, selectedLang]);

  const cues = useMemo(() => activeTrack?.cues ?? [], [activeTrack]);

  // Lazy-index all lessons' subtitles when user switches to "All lessons" search
  useEffect(() => {
    if (scope !== 'course' || !course || courseCues !== null) return;

    const targetCourse = course;
    let cancelled = false;
    async function indexAllSubtitles() {
      setIndexingCourse(true);
      const results: {
        lesson: Lesson;
        moduleTitle: string;
        cues: SubtitleCue[];
      }[] = [];
      const pref = readCaptionPreference();

      for (const mod of targetCourse.modules) {
        for (const lesson of mod.lessons) {
          if (!lesson.subtitles || lesson.subtitles.length === 0) continue;
          const unique = dedupeSubtitles(lesson.subtitles);
          const chosenLang =
            pickDefaultSubtitle(unique, { ...pref, enabled: true }) ??
            unique[0].language;
          const sub =
            unique.find((s) => s.language === chosenLang) ?? unique[0];
          try {
            const parsed = await readSubtitleCues(sub.fileHandle, sub.format);
            if (cancelled) return;
            if (parsed.length > 0) {
              results.push({ lesson, moduleTitle: mod.title, cues: parsed });
            }
          } catch {
            // Skip unreadable subtitle files
          }
        }
      }

      if (!cancelled) {
        setCourseCuesState({ courseName: targetCourse.name, entries: results });
        setIndexingCourse(false);
      }
    }

    indexAllSubtitles();
    return () => {
      cancelled = true;
    };
  }, [scope, course, courseCues]);

  const activeCueIndex = useMemo(
    () => findActiveCueIndex(cues, currentTime),
    [cues, currentTime],
  );

  const filteredCues = useMemo(
    () => searchSubtitleCues(cues, query),
    [cues, query],
  );

  const courseMatches = useMemo<CourseSubtitleMatch[]>(() => {
    if (scope !== 'course' || !courseCues || query.trim() === '') return [];
    const matches: CourseSubtitleMatch[] = [];
    for (const entry of courseCues) {
      const found = searchSubtitleCues(entry.cues, query);
      for (const cue of found) {
        matches.push({
          lesson: entry.lesson,
          moduleTitle: entry.moduleTitle,
          cue,
        });
        if (matches.length >= 150) return matches;
      }
    }
    return matches;
  }, [scope, courseCues, query]);

  // Smoothly scroll the active cue into view when playing (unless searching or user scrolled away)
  useEffect(() => {
    if (
      scope !== 'lesson' ||
      query.trim() !== '' ||
      !autoScroll ||
      activeCueIndex === -1 ||
      !activeCueRef.current ||
      !listRef.current
    ) {
      return;
    }

    programmaticScrollRef.current = true;
    activeCueRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    const timer = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 450);
    return () => clearTimeout(timer);
  }, [activeCueIndex, autoScroll, query, scope]);

  const handleListScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;
    if (autoScroll && query.trim() === '' && scope === 'lesson') {
      setAutoScroll(false);
      setUserScrolledAway(true);
    }
  }, [autoScroll, query, scope]);

  const handleResync = useCallback(() => {
    setAutoScroll(true);
    setUserScrolledAway(false);
    if (activeCueRef.current) {
      programmaticScrollRef.current = true;
      activeCueRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 450);
    }
  }, []);

  const isSearching = query.trim() !== '';

  return (
    <aside
      aria-label="Transcript"
      className="flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm h-[420px] lg:h-[calc(100vh-8.5rem)] lg:sticky lg:top-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-surface-hover/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent shrink-0"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <line x1="8" y1="9" x2="16" y2="9" />
            <line x1="8" y1="13" x2="13" y2="13" />
          </svg>
          <h2 className="text-sm font-semibold text-foreground truncate">
            Transcript
          </h2>
          {tracks.length > 1 && scope === 'lesson' && (
            <select
              aria-label="Transcript language"
              value={activeTrack?.language ?? ''}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="ml-1 h-6 rounded-md bg-background border border-border text-[11px] text-foreground px-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {tracks.map((t) => (
                <option key={t.language} value={t.language}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close transcript"
          title="Close transcript (T)"
          className={`p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING}`}
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

      {/* Search & Scope bar */}
      <div className="px-3 py-2.5 border-b border-border/60 space-y-2 shrink-0">
        <div className="relative">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (query) setQuery('');
                else e.currentTarget.blur();
              }
            }}
            placeholder={
              scope === 'course'
                ? 'Search subtitles across all lessons…'
                : 'Search transcript…'
            }
            aria-label="Search transcript"
            className="w-full rounded-lg border border-border-subtle bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-subtle focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div
            role="tablist"
            aria-label="Transcript search scope"
            className="inline-flex rounded-lg bg-background p-0.5 border border-border-subtle"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'lesson'}
              onClick={() => setScope('lesson')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                scope === 'lesson'
                  ? 'bg-accent/15 text-accent'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              This lesson
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'course'}
              onClick={() => setScope('course')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                scope === 'course'
                  ? 'bg-accent/15 text-accent'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              All lessons
            </button>
          </div>

          <span className="font-mono text-[10px] text-foreground-subtle">
            {scope === 'lesson'
              ? isSearching
                ? `${filteredCues.length} match${filteredCues.length === 1 ? '' : 'es'}`
                : `${cues.length} lines`
              : indexingCourse
                ? 'Indexing…'
                : isSearching
                  ? `${courseMatches.length}${courseMatches.length >= 150 ? '+' : ''} match${courseMatches.length === 1 ? '' : 'es'}`
                  : `${courseCues?.length ?? 0} subtitled`}
          </span>
        </div>
      </div>

      {/* Sync pill when user manually scrolled away */}
      {scope === 'lesson' && !isSearching && userScrolledAway && activeCueIndex !== -1 && (
        <div className="px-3 py-1.5 border-b border-border/50 bg-accent/8 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-foreground-muted">
            Auto-scroll paused
          </span>
          <button
            type="button"
            onClick={handleResync}
            className={`text-[11px] font-medium text-accent hover:text-accent-hover transition-colors ${FOCUS_RING} rounded px-1`}
          >
            Sync to video
          </button>
        </div>
      )}

      {/* Cue list */}
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
      >
        {scope === 'lesson' ? (
          cues.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <p className="text-xs font-medium text-foreground-muted">
                No subtitles for this lesson
              </p>
              <p className="mt-1 text-[11px] text-foreground-subtle">
                Switch to &ldquo;All lessons&rdquo; to search transcripts across
                the course.
              </p>
            </div>
          ) : filteredCues.length === 0 ? (
            <div className="py-10 text-center text-xs text-foreground-subtle">
              No matching lines for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCues.map((cue) => {
              const isActive =
                !isSearching &&
                activeCueIndex !== -1 &&
                cues[activeCueIndex]?.id === cue.id;
              return (
                <button
                  key={cue.id}
                  ref={isActive ? activeCueRef : null}
                  type="button"
                  onClick={() => onSeek(cue.startTime)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${FOCUS_RING} ${
                    isActive
                      ? 'bg-accent/15 text-foreground'
                      : 'hover:bg-surface-hover text-foreground-muted hover:text-foreground'
                  }`}
                >
                  <span
                    className={`shrink-0 font-mono text-[11px] tabular-nums pt-0.5 ${
                      isActive ? 'text-accent font-semibold' : 'text-foreground-subtle'
                    }`}
                  >
                    {formatTimestamp(cue.startTime)}
                  </span>
                  <span
                    className={`text-xs leading-relaxed flex-1 ${
                      isActive ? 'text-foreground font-medium' : ''
                    }`}
                  >
                    <HighlightedText text={cue.text} query={query} />
                  </span>
                </button>
              );
            })
          )
        ) : indexingCourse ? (
          <div className="py-10 text-center font-mono text-xs text-foreground-subtle animate-pulse">
            Indexing course subtitles…
          </div>
        ) : !isSearching ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <p className="text-xs font-medium text-foreground-muted">
              Search across the whole course
            </p>
            <p className="mt-1 text-[11px] text-foreground-subtle">
              Type a keyword above to find spoken mentions in any subtitled
              lesson and jump straight to that timestamp.
            </p>
          </div>
        ) : courseMatches.length === 0 ? (
          <div className="py-10 text-center text-xs text-foreground-subtle">
            No subtitle matches across this course for &ldquo;{query}&rdquo;
          </div>
        ) : (
          courseMatches.map((match, idx) => {
            const isCurrent = currentLesson?.id === match.lesson.id;
            return (
              <button
                key={`${match.lesson.id}-${match.cue.id}-${idx}`}
                type="button"
                onClick={() => onJumpToLessonCue(match.lesson, match.cue.startTime)}
                className={`w-full flex flex-col gap-1 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-surface-hover ${FOCUS_RING}`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] text-foreground-subtle">
                  <span className="truncate font-medium">
                    {isCurrent ? 'Current · ' : ''}
                    {getDisplayTitle(match.lesson, lessonOverrides)}
                  </span>
                  <span className="shrink-0 font-mono text-accent">
                    {formatTimestamp(match.cue.startTime)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground-muted">
                  <HighlightedText text={match.cue.text} query={query} />
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
