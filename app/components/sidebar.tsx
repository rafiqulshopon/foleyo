'use client';

import { useState, useEffect, useRef } from 'react';
import { useCourse } from '@/app/context/course-context';
import { getCompletionStats, getLessonProgress } from '@/app/lib/progress-store';
import { useCourseNotes } from '@/app/lib/use-notes';
import { useCourseBookmarks, type CourseBookmarks } from '@/app/lib/bookmarks';
import {
  countHiddenLessons,
  getDisplayTitle,
  isLessonHidden,
  renameLesson,
  setLessonHidden,
  unhideAllLessons,
  useLessonOverrides,
  type LessonOverrides,
} from '@/app/lib/lesson-overrides';
import { FOCUS_RING } from '@/app/components/focus-ring';
import {
  getLessonKind,
  hasCodecRisk,
  isInAppResource,
  type CourseResource,
  type Lesson,
  type Module,
} from '@/app/types';

function ResourceIcon({ kind }: { kind: CourseResource['kind'] }) {
  switch (kind) {
    case 'pdf':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-danger/80">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      );
    case 'markdown':
    case 'text':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent/80">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      );
    case 'folder':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-warning/80">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'archive':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground-muted">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      );
    default:
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground-muted">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      );
  }
}

function ResourceRow({
  resource,
  isActive,
  onOpen,
}: {
  resource: CourseResource;
  isActive: boolean;
  onOpen: (resource: CourseResource) => void;
}) {
  const inApp = isInAppResource(resource.kind);
  const badge =
    resource.kind === 'folder'
      ? 'DIR'
      : resource.extension
      ? resource.extension.slice(1).toUpperCase()
      : 'FILE';

  return (
    <button
      onClick={() => onOpen(resource)}
      title={
        inApp
          ? `Open ${resource.name} in app`
          : `Download / open ${resource.name} in system`
      }
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${FOCUS_RING} ${
        isActive
          ? 'bg-accent/15 text-foreground font-medium'
          : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground'
      }`}
    >
      <ResourceIcon kind={resource.kind} />
      <span className="text-xs truncate flex-1">{resource.title}</span>
      <span className="shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-surface border border-border/50 text-foreground-subtle">
        {badge}
      </span>
      {!inApp && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-foreground-subtle"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );
}

function ModuleItem({
  courseName,
  module,
  lessons,
  resources,
  forceExpanded = false,
  notes,
  bookmarks,
  overrides,
}: {
  courseName: string;
  module: Module;
  /** Lessons to render — filtered by search / hidden visibility. */
  lessons: Lesson[];
  resources: CourseResource[];
  forceExpanded?: boolean;
  notes: Record<string, string>;
  bookmarks: CourseBookmarks;
  overrides: LessonOverrides;
}) {
  const {
    currentLesson,
    activeResource,
    selectLesson,
    openResource,
    progress,
    markComplete,
    setModuleComplete,
    hideLesson,
  } = useCourse();
  const [expanded, setExpanded] = useState(true);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const effectiveExpanded = forceExpanded || expanded;
  const visibleModuleLessons = module.lessons.filter(
    (l) => !isLessonHidden(l.id, overrides)
  );
  const stats = getCompletionStats(
    progress,
    visibleModuleLessons.map((l) => l.id)
  );
  const allModuleDone = stats.total > 0 && stats.completed === stats.total;
  const isActive =
    !activeResource && module.lessons.some((l) => l.id === currentLesson?.id);
  const activeLessonRef = useRef<HTMLDivElement>(null);
  const lessonsId = `module-${module.index}-lessons`;

  // Auto-expand this module when it contains the current lesson.
  const [prevActiveKey, setPrevActiveKey] = useState<string | null>(null);
  const activeKey = isActive ? (currentLesson?.id ?? null) : null;
  if (activeKey !== prevActiveKey) {
    setPrevActiveKey(activeKey);
    if (activeKey && !expanded) {
      setExpanded(true);
    }
  }

  useEffect(() => {
    if (!isActive || !currentLesson?.id) return;
    const timer = setTimeout(() => {
      activeLessonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [isActive, currentLesson?.id]);

  useEffect(() => {
    if (editingLessonId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingLessonId]);

  const startRename = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setDraftTitle(getDisplayTitle(lesson, overrides));
  };

  const commitRename = (lesson: Lesson) => {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === lesson.title) {
      renameLesson(courseName, lesson.id, null);
    } else {
      renameLesson(courseName, lesson.id, trimmed);
    }
    setEditingLessonId(null);
  };

  const cancelRename = () => {
    setEditingLessonId(null);
  };

  return (
    <div className="mb-1">
      {/* Module header */}
      <div
        className={`flex items-center gap-1 rounded-lg transition-all group ${
          isActive
            ? 'bg-accent/8 text-foreground'
            : 'hover:bg-surface-hover text-foreground-muted hover:text-foreground'
        }`}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={effectiveExpanded}
          aria-controls={lessonsId}
          className={`flex-1 min-w-0 flex items-center gap-2 pl-3 pr-1 py-2.5 rounded-lg text-left ${FOCUS_RING}`}
        >
          {/* Expand/collapse chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-200 ${
              effectiveExpanded ? 'rotate-90' : ''
            }`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{module.title}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {/* Mini progress bar */}
              <div
                className="flex-1 h-1 bg-border rounded-full overflow-hidden"
                role="progressbar"
                aria-label={`${module.title} completion`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stats.percentage}
              >
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-foreground-subtle whitespace-nowrap">
                {stats.completed}/{stats.total}
              </span>
            </div>
          </div>
        </button>

        {/* Mark whole module done / undone */}
        {visibleModuleLessons.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModuleComplete(module.id, !allModuleDone);
            }}
            aria-label={
              allModuleDone
                ? `Mark ${module.title} as incomplete`
                : `Mark ${module.title} as complete`
            }
            title={
              allModuleDone
                ? 'Mark module incomplete'
                : 'Mark entire module complete'
            }
            className={`shrink-0 mr-1.5 p-1.5 rounded-md transition-all ${FOCUS_RING} ${
              allModuleDone
                ? 'text-success hover:bg-success/15'
                : 'text-foreground-subtle opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground hover:bg-surface'
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </button>
        )}
      </div>

      {/* Lessons & resources list — CSS grid height transition so tall lists never clip */}
      <div
        id={lessonsId}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          effectiveExpanded
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-3 pl-3 border-l border-border-subtle py-0.5">
            {lessons.map((lesson) => {
              const isCurrentLesson =
                !activeResource && currentLesson?.id === lesson.id;
              const lessonProgress = getLessonProgress(progress, lesson.id);
              const kind = getLessonKind(lesson);
              const isHtml = kind === 'html';
              const isUnsupported = !isHtml && hasCodecRisk(lesson.fileName);
              const formatStr = lesson.fileName.split('.').pop()?.toUpperCase();
              const hidden = isLessonHidden(lesson.id, overrides);
              const displayTitle = getDisplayTitle(lesson, overrides);
              const isEditing = editingLessonId === lesson.id;

              return (
                <div
                  key={lesson.id}
                  ref={isCurrentLesson ? activeLessonRef : null}
                  role="button"
                  tabIndex={0}
                  aria-current={isCurrentLesson ? 'true' : undefined}
                  aria-label={`${isHtml ? 'Read' : 'Play'} lesson: ${displayTitle}`}
                  className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-all ${FOCUS_RING} ${
                    hidden
                      ? 'opacity-50 hover:opacity-80 text-foreground-subtle'
                      : isCurrentLesson
                      ? 'bg-accent/12 text-foreground'
                      : 'hover:bg-surface-hover text-foreground-muted hover:text-foreground'
                  }`}
                  onClick={() => {
                    if (!isEditing) selectLesson(lesson);
                  }}
                  onKeyDown={(e) => {
                    if (isEditing || e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectLesson(lesson);
                    }
                  }}
                >
                  {/* Completion checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markComplete(lesson.id);
                    }}
                    aria-label={
                      lessonProgress.completed
                        ? 'Mark as incomplete'
                        : 'Mark as complete'
                    }
                    aria-pressed={lessonProgress.completed}
                    className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${FOCUS_RING} ${
                      lessonProgress.completed
                        ? 'bg-success border-success text-background'
                        : 'border-border hover:border-foreground-muted'
                    }`}
                    title={
                      lessonProgress.completed
                        ? 'Mark as incomplete'
                        : 'Mark as complete'
                    }
                  >
                    {lessonProgress.completed && (
                      <svg
                        width="9"
                        height="9"
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
                  </button>

                  {/* Active indicator */}
                  {isCurrentLesson && !isEditing ? (
                    isHtml ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="shrink-0 text-accent"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    ) : (
                      <div className="shrink-0 flex items-center gap-0.5">
                        <span className="w-0.5 h-3 bg-accent rounded-full animate-pulse" />
                        <span
                          className="w-0.5 h-4 bg-accent rounded-full animate-pulse"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <span
                          className="w-0.5 h-2.5 bg-accent rounded-full animate-pulse"
                          style={{ animationDelay: '0.3s' }}
                        />
                      </div>
                    )
                  ) : null}

                  {/* Lesson title or inline rename input */}
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => commitRename(lesson)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRename(lesson);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      aria-label="Rename lesson"
                      placeholder={lesson.title}
                      className="flex-1 min-w-0 bg-background border border-accent/60 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  ) : (
                    <span
                      title={
                        displayTitle !== lesson.title
                          ? `${displayTitle} (original: ${lesson.fileName})`
                          : lesson.fileName
                      }
                      className={`text-[13px] truncate flex-1 ${
                        isCurrentLesson ? 'font-medium' : ''
                      } ${lessonProgress.completed ? 'line-through opacity-60' : ''} ${
                        hidden ? 'italic' : ''
                      }`}
                    >
                      {displayTitle}
                    </span>
                  )}

                  {/* Row hover actions: Rename & Hide/Unhide */}
                  {!isEditing && (
                    <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(lesson);
                        }}
                        aria-label={`Rename ${displayTitle}`}
                        title="Rename lesson (app only)"
                        className={`p-1 rounded text-foreground-subtle hover:text-foreground hover:bg-surface ${FOCUS_RING}`}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hidden) {
                            setLessonHidden(courseName, lesson.id, false);
                          } else {
                            hideLesson(lesson.id);
                          }
                        }}
                        aria-label={
                          hidden
                            ? `Unhide ${displayTitle}`
                            : `Hide ${displayTitle}`
                        }
                        title={hidden ? 'Restore hidden lesson' : 'Hide lesson'}
                        className={`p-1 rounded text-foreground-subtle hover:text-foreground hover:bg-surface ${FOCUS_RING}`}
                      >
                        {hidden ? (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Badges (hidden while inline-editing) */}
                  {!isEditing && (
                    <>
                      {((notes[lesson.id] && notes[lesson.id].trim() !== '') ||
                        (bookmarks[lesson.id] &&
                          bookmarks[lesson.id].length > 0)) && (
                        <span
                          title="Has notes or bookmarks"
                          className="shrink-0 flex items-center"
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-accent/80"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                      )}

                      {isHtml && (
                        <span
                          className="shrink-0 text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-accent/15 text-accent"
                          title="HTML article lesson"
                        >
                          HTML
                        </span>
                      )}

                      {lesson.subtitles && lesson.subtitles.length > 0 && (
                        <span
                          className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-surface border border-border/50 text-foreground-subtle"
                          title="Subtitles available"
                        >
                          CC
                        </span>
                      )}

                      {isUnsupported && (
                        <span
                          className="shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-warning/15 text-warning"
                          title={`${formatStr} files may not play with all codecs`}
                        >
                          {formatStr}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Module Resources */}
            {resources.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-border-subtle/70">
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle">
                  Resources ({resources.length})
                </p>
                <div className="space-y-0.5">
                  {resources.map((res) => (
                    <ResourceRow
                      key={res.id}
                      resource={res}
                      isActive={activeResource?.id === res.id}
                      onOpen={openResource}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const {
    course,
    activeResource,
    openResource,
    sidebarOpen,
    toggleSidebar,
    refreshCourse,
    resetProgress,
    isLoading,
  } = useCourse();
  const notes = useCourseNotes(course?.name);
  const bookmarks = useCourseBookmarks(course?.name);
  const overrides = useLessonOverrides(course?.name);
  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!course) return null;

  const hiddenCount = countHiddenLessons(course, overrides);
  const visibleTotal = course.totalLessons - hiddenCount;

  const q = query.trim().toLowerCase();
  const filtering = q !== '';

  const entries = course.modules
    .map((module) => {
      const candidateLessons = showHidden
        ? module.lessons
        : module.lessons.filter((l) => !isLessonHidden(l.id, overrides));
      const moduleResources = module.resources ?? [];

      if (!filtering) {
        return {
          module,
          lessons: candidateLessons,
          resources: moduleResources,
        };
      }

      const titleMatches = module.title.toLowerCase().includes(q);
      const matchedLessons = titleMatches
        ? candidateLessons
        : candidateLessons.filter((l) =>
            getDisplayTitle(l, overrides).toLowerCase().includes(q)
          );
      const matchedResources = titleMatches
        ? moduleResources
        : moduleResources.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.name.toLowerCase().includes(q)
          );

      return {
        module,
        lessons: matchedLessons,
        resources: matchedResources,
      };
    })
    .filter((e) => e.lessons.length > 0 || e.resources.length > 0);

  const rootResources = (course.resources ?? []).filter(
    (r) =>
      !filtering ||
      r.title.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
  );

  return (
    <div className="relative flex shrink-0">
      <aside
        className={`sidebar-transition border-r border-border bg-surface/50 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden ${
          sidebarOpen ? 'w-72' : 'w-0'
        }`}
      >
        {/* Fixed header — not scrollable */}
        <div className="px-3 pt-3 pb-1 min-w-[288px] border-b border-border/50 shrink-0">
          <div className="px-3 py-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2
                className="text-sm font-semibold text-foreground truncate"
                title={course.name}
              >
                {course.name}
              </h2>
              <p className="text-xs text-foreground-subtle mt-0.5">
                {course.modules.length} module
                {course.modules.length !== 1 ? 's' : ''} · {visibleTotal} lesson
                {visibleTotal !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={refreshCourse}
                disabled={isLoading}
                aria-label="Refresh course folder to detect new downloads"
                className={`p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING} ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Refresh course folder to detect new downloads"
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
                  className={isLoading ? 'animate-spin' : ''}
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>

              {/* Reset course progress */}
              <button
                onClick={() => setConfirmReset((prev) => !prev)}
                aria-label="Reset course progress"
                aria-expanded={confirmReset}
                className={`p-1.5 rounded-lg transition-colors ${FOCUS_RING} ${
                  confirmReset
                    ? 'bg-danger/15 text-danger'
                    : 'text-foreground-muted hover:text-danger hover:bg-surface-hover'
                }`}
                title="Reset course progress"
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
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>

              {/* Collapse sidebar button */}
              <button
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                className={`p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING}`}
                title="Collapse sidebar"
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
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Inline Reset Progress Confirmation */}
          {confirmReset && (
            <div className="mx-3 mb-2 p-2.5 rounded-lg bg-danger/10 border border-danger/25 flex items-center justify-between gap-2">
              <span className="text-[11px] text-danger font-medium">
                Reset all progress?
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setConfirmReset(false)}
                  className={`px-2 py-1 rounded text-[11px] text-foreground-muted hover:text-foreground hover:bg-surface transition-colors ${FOCUS_RING}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    resetProgress();
                    setConfirmReset(false);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-medium bg-danger text-white hover:bg-danger/90 transition-colors ${FOCUS_RING}`}
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Lesson filter — always visible above the scroll area */}
          <div className="px-3 pb-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (query) setQuery('');
                  e.currentTarget.blur();
                }
              }}
              placeholder="Filter lessons & resources…"
              aria-label="Filter lessons and resources"
              className="w-full rounded-lg border border-border-subtle bg-surface-hover/40 px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground-subtle transition-colors focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>

          {/* Hidden lessons bar */}
          {hiddenCount > 0 && (
            <div className="px-3 pb-2 flex items-center justify-between text-[11px] text-foreground-subtle">
              <span>
                {hiddenCount} hidden lesson{hiddenCount !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHidden((prev) => !prev)}
                  className={`text-accent hover:text-accent-hover font-medium ${FOCUS_RING} rounded`}
                >
                  {showHidden ? 'Hide' : 'Show'}
                </button>
                {showHidden && (
                  <button
                    onClick={() => {
                      unhideAllLessons(course.name);
                      setShowHidden(false);
                    }}
                    className={`text-foreground-muted hover:text-foreground ${FOCUS_RING} rounded`}
                  >
                    Restore all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable module list */}
        <div className="flex-1 overflow-y-auto p-3 min-w-[288px]">
          <nav>
            {entries.length === 0 && rootResources.length === 0 ? (
              <p className="px-2 py-6 text-center font-mono text-[11px] text-foreground-subtle">
                No lessons match
              </p>
            ) : (
              <>
                {entries.map(({ module, lessons, resources }) => (
                  <ModuleItem
                    key={module.id}
                    courseName={course.name}
                    module={module}
                    lessons={lessons}
                    resources={resources}
                    forceExpanded={filtering}
                    notes={notes}
                    bookmarks={bookmarks}
                    overrides={overrides}
                  />
                ))}

                {rootResources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
                      Course Resources ({rootResources.length})
                    </p>
                    <div className="px-1 space-y-0.5">
                      {rootResources.map((res) => (
                        <ResourceRow
                          key={res.id}
                          resource={res}
                          isActive={activeResource?.id === res.id}
                          onOpen={openResource}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </nav>
        </div>
      </aside>

      {/* Floating expand button when sidebar is collapsed */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          className={`absolute left-0 top-3 z-10 flex items-center justify-center w-6 h-12 rounded-r-lg bg-surface border border-l-0 border-border text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-all shadow-sm ${FOCUS_RING}`}
          title="Expand sidebar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="13 17 18 12 13 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
