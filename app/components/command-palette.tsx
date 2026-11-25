'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useCourse } from '@/app/context/course-context';
import { useTheme } from '@/app/context/theme-context';
import { useLessonDurations } from '@/app/context/lesson-durations-context';
import {
  getDisplayTitle,
  getVisibleLessons,
  useLessonOverrides,
} from '@/app/lib/lesson-overrides';
import { getLessonProgress } from '@/app/lib/progress-store';
import {
  loadRecentCourses,
  type RecentCourse,
} from '@/app/lib/recent-courses-store';
import { searchSubtitleCues } from '@/app/lib/subtitles';
import { formatDuration, formatTimestamp } from '@/app/lib/time';
import { FOCUS_RING } from '@/app/components/focus-ring';

interface PaletteItem {
  id: string;
  group: 'Lessons' | 'Transcript' | 'Resources' | 'Courses' | 'Settings & Actions';
  title: string;
  subtitle?: string;
  badge?: string;
  completed?: boolean;
  keywords?: string;
  onSelect: () => void;
}

export function CommandPalette() {
  const {
    course,
    currentLesson,
    subtitleTracks,
    progress,
    autoplay,
    sidebarOpen,
    transcriptOpen,
    windowFullscreen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    selectLesson,
    openResource,
    openFolder,
    resumeRecentCourse,
    closeCourse,
    refreshCourse,
    toggleAutoplay,
    toggleSidebar,
    toggleTranscript,
    toggleWindowFullscreen,
    setActivityOpen,
  } = useCourse();
  const { theme, toggleTheme } = useTheme();
  const { lessonDurations } = useLessonDurations();
  const overrides = useLessonOverrides(course?.name);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [setCommandPaletteOpen]);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Focus input & refresh recent courses whenever opened
  useEffect(() => {
    if (!commandPaletteOpen) return;
    loadRecentCourses().then(setRecentCourses);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [commandPaletteOpen]);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    // 1. Lessons in current course
    if (course) {
      const moduleById = new Map(course.modules.map((m) => [m.id, m.title]));
      const visible = getVisibleLessons(course, overrides);
      for (const lesson of visible) {
        const title = getDisplayTitle(lesson, overrides);
        const modTitle = moduleById.get(lesson.moduleId) ?? '';
        const dur = lessonDurations[lesson.id];
        const done = getLessonProgress(progress, lesson.id).completed;
        items.push({
          id: `lesson-${lesson.id}`,
          group: 'Lessons',
          title,
          subtitle: modTitle,
          badge: dur ? formatDuration(dur) : undefined,
          completed: done,
          keywords: `${title} ${modTitle} ${lesson.fileName}`,
          onSelect: () => {
            close();
            selectLesson(lesson);
          },
        });
      }

      // 2. Transcript matches in the active lesson (when typing 2+ chars)
      if (currentLesson && subtitleTracks.length > 0 && query.trim().length >= 2) {
        const cues = subtitleTracks[0].cues;
        const matches = searchSubtitleCues(cues, query).slice(0, 8);
        for (const cue of matches) {
          items.push({
            id: `cue-${cue.id}`,
            group: 'Transcript',
            title: cue.text,
            subtitle: getDisplayTitle(currentLesson, overrides),
            badge: formatTimestamp(cue.startTime),
            keywords: cue.text,
            onSelect: () => {
              close();
              selectLesson(currentLesson, cue.startTime);
            },
          });
        }
      }

      // 3. Course & module resources
      const moduleResources = course.modules.flatMap((m) =>
        (m.resources ?? []).map((r) => ({ r, modTitle: m.title })),
      );
      const rootResources = (course.resources ?? []).map((r) => ({
        r,
        modTitle: 'Course Resources',
      }));
      for (const { r, modTitle } of [...moduleResources, ...rootResources]) {
        items.push({
          id: `res-${r.id}`,
          group: 'Resources',
          title: r.title,
          subtitle: modTitle,
          badge: r.kind.toUpperCase(),
          keywords: `${r.title} ${r.name} ${modTitle}`,
          onSelect: () => {
            close();
            openResource(r);
          },
        });
      }
    }

    // 4. Recent courses
    for (const rc of recentCourses) {
      items.push({
        id: `course-${rc.folderName}`,
        group: 'Courses',
        title: rc.name,
        subtitle: `${rc.completedLessons}/${rc.totalLessons} lessons · ${rc.percentage}%`,
        badge: course?.name === rc.name ? 'Open' : undefined,
        keywords: `${rc.name} ${rc.folderName} course`,
        onSelect: () => {
          close();
          if (course?.name !== rc.name) {
            resumeRecentCourse(rc.folderName);
          }
        },
      });
    }

    // 5. Settings & Actions
    const actions: PaletteItem[] = [
      {
        id: 'action-activity',
        group: 'Settings & Actions',
        title: 'Watch Activity, Streak & Daily Goal',
        subtitle: 'View calendar heatmap and edit your daily watch goal',
        keywords: 'streak history calendar goal watch time activity stats',
        onSelect: () => {
          close();
          setActivityOpen(true);
        },
      },
      {
        id: 'action-theme',
        group: 'Settings & Actions',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle color theme',
        keywords: 'theme dark light appearance mode setting',
        onSelect: () => {
          close();
          toggleTheme();
        },
      },
      {
        id: 'action-open-folder',
        group: 'Settings & Actions',
        title: 'Open Course Folder…',
        subtitle: 'Load a local course directory from disk',
        keywords: 'open folder directory course load',
        onSelect: () => {
          close();
          openFolder();
        },
      },
    ];

    if (course) {
      actions.push(
        {
          id: 'action-transcript',
          group: 'Settings & Actions',
          title: transcriptOpen ? 'Hide Transcript Panel' : 'Show Transcript & Subtitle Search',
          subtitle: 'Search subtitles and jump to timestamps',
          badge: 'T',
          keywords: 'transcript subtitles captions search text',
          onSelect: () => {
            close();
            toggleTranscript();
          },
        },
        {
          id: 'action-autoplay',
          group: 'Settings & Actions',
          title: autoplay ? 'Turn Off Autoplay' : 'Turn On Autoplay',
          subtitle: 'Auto-advance to the next lesson when a video ends',
          keywords: 'autoplay setting next lesson',
          onSelect: () => {
            close();
            toggleAutoplay();
          },
        },
        {
          id: 'action-sidebar',
          group: 'Settings & Actions',
          title: sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar',
          subtitle: 'Show or hide the course modules sidebar',
          keywords: 'sidebar modules navigation',
          onSelect: () => {
            close();
            toggleSidebar();
          },
        },
        {
          id: 'action-window-fs',
          group: 'Settings & Actions',
          title: windowFullscreen ? 'Exit Fill Window' : 'Fill Window Fullscreen',
          subtitle: 'Expand the player to fill the browser viewport',
          badge: 'F',
          keywords: 'fullscreen fill window theater',
          onSelect: () => {
            close();
            toggleWindowFullscreen();
          },
        },
        {
          id: 'action-refresh',
          group: 'Settings & Actions',
          title: 'Refresh Course Folder',
          subtitle: 'Re-scan disk for newly added lessons or subtitles',
          keywords: 'refresh reload scan files',
          onSelect: () => {
            close();
            refreshCourse();
          },
        },
        {
          id: 'action-close-course',
          group: 'Settings & Actions',
          title: 'Back to All Courses',
          subtitle: 'Close current course and return to library',
          keywords: 'home library back close course',
          onSelect: () => {
            close();
            closeCourse();
          },
        },
      );
    }

    items.push(...actions);
    return items;
  }, [
    course,
    currentLesson,
    subtitleTracks,
    progress,
    overrides,
    lessonDurations,
    recentCourses,
    query,
    theme,
    autoplay,
    sidebarOpen,
    transcriptOpen,
    windowFullscreen,
    close,
    selectLesson,
    openResource,
    resumeRecentCourse,
    setActivityOpen,
    toggleTheme,
    openFolder,
    toggleTranscript,
    toggleAutoplay,
    toggleSidebar,
    toggleWindowFullscreen,
    refreshCourse,
    closeCourse,
  ]);

  const filteredItems = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) {
      // Show a focused default set: settings, recent courses, and first 12 lessons
      const lessons = allItems.filter((i) => i.group === 'Lessons').slice(0, 12);
      const rest = allItems.filter((i) => i.group !== 'Lessons');
      return [...lessons, ...rest];
    }

    return allItems.filter((item) => {
      if (item.group === 'Transcript') return true; // already filtered by query
      const haystack = `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''} ${item.group}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [allItems, query]);

  // Clamp selectedIndex when list shrinks
  const safeIndex =
    filteredItems.length === 0
      ? 0
      : Math.min(selectedIndex, filteredItems.length - 1);

  // Scroll highlighted row into view
  useEffect(() => {
    itemRefs.current[safeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex]);

  if (!commandPaletteOpen) return null;

  // Group filtered items while preserving flat index for keyboard nav
  const groups: { name: PaletteItem['group']; items: { item: PaletteItem; flatIndex: number }[] }[] = [];
  filteredItems.forEach((item, flatIndex) => {
    let g = groups.find((x) => x.name === item.group);
    if (!g) {
      g = { name: item.group, items: [] };
      groups.push(g);
    }
    g.items.push({ item, flatIndex });
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0
          ? (prev - 1 + filteredItems.length) % filteredItems.length
          : 0,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredItems[safeIndex];
      if (target) target.onSelect();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground-subtle shrink-0"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={
              course
                ? 'Jump to a lesson, transcript line, course, or setting…'
                : 'Jump to a course or setting…'
            }
            aria-label="Search lessons, courses, and settings"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none"
          />
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground-subtle">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-foreground-subtle">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="mb-2 last:mb-0">
                <p className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                  {group.name}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ item, flatIndex }) => {
                    const active = flatIndex === safeIndex;
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          itemRefs.current[flatIndex] = el;
                        }}
                        type="button"
                        onClick={item.onSelect}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${FOCUS_RING} ${
                          active
                            ? 'bg-accent/15 text-foreground'
                            : 'text-foreground-muted hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {item.completed !== undefined && (
                            <span
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                item.completed
                                  ? 'bg-success border-success text-background'
                                  : 'border-border'
                              }`}
                              aria-hidden="true"
                            >
                              {item.completed && (
                                <svg
                                  width="8"
                                  height="8"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs truncate ${
                                active ? 'text-foreground font-medium' : 'text-foreground'
                              }`}
                            >
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-[11px] text-foreground-subtle truncate">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        {item.badge && (
                          <span className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded bg-background border border-border-subtle text-foreground-subtle">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-hover/40 font-mono text-[10px] text-foreground-subtle">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
          <span>⌘K</span>
        </div>
      </div>
    </div>
  );
}
