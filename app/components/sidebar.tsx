'use client';

import { useState, useEffect, useRef } from 'react';
import { useCourse } from '@/app/context/course-context';
import { getLessonProgress } from '@/app/lib/progress-store';
import { useCourseNotes } from '@/app/lib/use-notes';
import type { Module } from '@/app/types';

function ModuleItem({ module, notes }: { module: Module; notes: Record<string, string> }) {
  const { currentLesson, selectLesson, progress, markComplete, getModuleStats } =
    useCourse();
  const [expanded, setExpanded] = useState(true);
  const stats = getModuleStats(module.id);
  const isActive = module.lessons.some((l) => l.id === currentLesson?.id);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-expand module containing the current lesson
  useEffect(() => {
    if (isActive && !expanded) {
      setExpanded(true);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-1">
      {/* Module header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all group ${
          isActive
            ? 'bg-accent/8 text-foreground'
            : 'hover:bg-surface-hover text-foreground-muted hover:text-foreground'
        }`}
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
            expanded ? 'rotate-90' : ''
          }`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{module.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Mini progress bar */}
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
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

      {/* Lessons list */}
      <div
        ref={listRef}
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{
          maxHeight: expanded ? `${(module.lessons.length + 1) * 48}px` : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="ml-3 pl-3 border-l border-border-subtle">
          {module.lessons.map((lesson) => {
            const isCurrentLesson = currentLesson?.id === lesson.id;
            const lessonProgress = getLessonProgress(progress, lesson.id);
            const isUnsupported = lesson.fileName.toLowerCase().endsWith('.mkv') || lesson.fileName.toLowerCase().endsWith('.ts');
            const formatStr = lesson.fileName.split('.').pop()?.toUpperCase();

            return (
              <div
                key={lesson.id}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                  isCurrentLesson
                    ? 'bg-accent/12 text-foreground'
                    : 'hover:bg-surface-hover text-foreground-muted hover:text-foreground'
                }`}
                onClick={() => selectLesson(lesson)}
              >
                {/* Completion checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markComplete(lesson.id);
                  }}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
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
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Playing indicator or lesson index */}
                {isCurrentLesson ? (
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
                ) : null}

                {/* Lesson title */}
                <span
                  className={`text-[13px] truncate flex-1 ${
                    isCurrentLesson ? 'font-medium' : ''
                  } ${lessonProgress.completed ? 'line-through opacity-60' : ''}`}
                >
                  {lesson.title}
                </span>

                {/* Notes indicator */}
                {notes[lesson.id] && notes[lesson.id].trim() !== '' && (
                  <span title="Has notes" className="shrink-0 flex items-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent/80">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </span>
                )}

                {/* CC badge */}
                {lesson.subtitles && lesson.subtitles.length > 0 && (
                  <span 
                    className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-surface border border-border/50 text-foreground-subtle"
                    title="Subtitles available"
                  >
                    CC
                  </span>
                )}

                {/* Unsupported format warning badge */}
                {isUnsupported && (
                  <span
                    className="shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-warning/15 text-warning"
                    title={`${formatStr} files may not play with all codecs`}
                  >
                    {formatStr}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { course, sidebarOpen, toggleSidebar, refreshCourse, isLoading } = useCourse();
  const notes = useCourseNotes(course?.name);

  if (!course) return null;

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
              <h2 className="text-sm font-semibold text-foreground truncate" title={course.name}>
                {course.name}
              </h2>
              <p className="text-xs text-foreground-subtle mt-0.5">
                {course.modules.length} module{course.modules.length !== 1 ? 's' : ''} ·{' '}
                {course.totalLessons} lesson{course.totalLessons !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={refreshCourse}
                disabled={isLoading}
                className={`p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              {/* Collapse sidebar button */}
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="Collapse sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable module list */}
        <div className="flex-1 overflow-y-auto p-3 min-w-[288px]">
          <nav>
            {course.modules.map((module) => (
              <ModuleItem key={module.id} module={module} notes={notes} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Floating expand button when sidebar is collapsed */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute left-0 top-3 z-10 flex items-center justify-center w-6 h-12 rounded-r-lg bg-surface border border-l-0 border-border text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-all shadow-sm"
          title="Expand sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
