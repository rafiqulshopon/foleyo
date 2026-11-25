'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCourse } from '@/app/context/course-context';
import { useTheme } from '@/app/context/theme-context';
import { getLessonProgress } from '@/app/lib/progress-store';
import { useNotes } from '@/app/lib/use-notes';
import {
  getDisplayTitle,
  getVisibleLessons,
  useLessonOverrides,
} from '@/app/lib/lesson-overrides';
import { openFileInNewTab } from '@/app/lib/open-resource';
import { FOCUS_RING } from '@/app/components/focus-ring';

function buildSandboxedHtml(rawHtml: string, theme: 'dark' | 'light'): string {
  const isDark = theme === 'dark';
  const baseStyle = `
    <style data-foleyo-base>
      :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
      body {
        margin: 0;
        padding: 28px 32px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 15px;
        line-height: 1.7;
        background: ${isDark ? '#12121a' : '#ffffff'};
        color: ${isDark ? '#e8e8f0' : '#111122'};
        word-wrap: break-word;
      }
      a { color: ${isDark ? '#8e72ff' : '#6c47f0'}; }
      img { max-width: 100%; height: auto; border-radius: 8px; }
      pre, code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: ${isDark ? '#1a1a25' : '#f0f0f3'};
        border-radius: 6px;
      }
      code { padding: 0.15em 0.35em; font-size: 0.9em; }
      pre { padding: 14px 16px; overflow-x: auto; }
      pre code { padding: 0; background: transparent; }
      blockquote {
        margin: 1em 0;
        padding: 0.5em 1em;
        border-left: 3px solid ${isDark ? '#7c5cfc' : '#6c47f0'};
        background: ${isDark ? 'rgba(124, 92, 252, 0.08)' : 'rgba(108, 71, 240, 0.06)'};
      }
      table { border-collapse: collapse; width: 100%; margin: 1em 0; }
      th, td {
        border: 1px solid ${isDark ? '#2a2a3a' : '#d4d4dc'};
        padding: 8px 12px;
        text-align: left;
      }
      hr { border: none; border-top: 1px solid ${isDark ? '#2a2a3a' : '#d4d4dc'}; margin: 1.5em 0; }
    </style>
    <base target="_blank" />
  `;

  if (/<head[\s>]/i.test(rawHtml)) {
    return rawHtml.replace(/<head([^>]*)>/i, `<head$1>${baseStyle}`);
  }
  if (/<html[\s>]/i.test(rawHtml)) {
    return rawHtml.replace(/<html([^>]*)>/i, `<html$1><head>${baseStyle}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />${baseStyle}</head><body>${rawHtml}</body></html>`;
}

export function HtmlLessonViewer() {
  const {
    course,
    currentLesson,
    progress,
    markComplete,
    nextLesson,
    prevLesson,
    requiresPermission,
    grantPermission,
  } = useCourse();
  const { theme } = useTheme();
  const overrides = useLessonOverrides(course?.name);
  const { note, updateNote, isSaved } = useNotes(
    course?.name,
    currentLesson?.id
  );

  const [loadedState, setLoadedState] = useState<{
    lessonId: string;
    html: string;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!currentLesson || requiresPermission) return;

    let cancelled = false;
    currentLesson.fileHandle
      .getFile()
      .then((file) => file.text())
      .then((text) => {
        if (!cancelled) {
          setLoadedState({ lessonId: currentLesson.id, html: text, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadedState({
            lessonId: currentLesson.id,
            html: '',
            error:
              err instanceof Error ? err.message : 'Failed to load HTML lesson',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentLesson, requiresPermission]);

  const visibleLessons = useMemo(
    () => getVisibleLessons(course, overrides),
    [course, overrides]
  );

  if (!currentLesson) return null;

  const isLoading = loadedState?.lessonId !== currentLesson.id;
  const htmlContent = !isLoading ? loadedState.html : '';
  const loadError = !isLoading ? loadedState.error : null;

  const lessonProgress = getLessonProgress(progress, currentLesson.id);
  const displayTitle = getDisplayTitle(currentLesson, overrides);
  const moduleTitle = course?.modules.find(
    (m) => m.id === currentLesson.moduleId
  )?.title;

  const currentIdx = visibleLessons.findIndex((l) => l.id === currentLesson.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx !== -1 && currentIdx < visibleLessons.length - 1;

  const srcDoc = htmlContent ? buildSandboxedHtml(htmlContent, theme) : '';

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-240 px-4 py-6 animate-fade-in">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider truncate">
                {moduleTitle}
              </p>
              <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                HTML
              </span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              {displayTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openFileInNewTab(currentLesson.fileHandle, 'text/html')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
              title="Open HTML article in a new browser tab"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span className="hidden sm:inline">Open tab</span>
            </button>

            <button
              onClick={() => markComplete(currentLesson.id)}
              aria-pressed={lessonProgress.completed}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${FOCUS_RING} ${
                lessonProgress.completed
                  ? 'bg-success/15 border-success/30 text-success hover:bg-success/20'
                  : 'bg-surface hover:bg-surface-hover border-border text-foreground-muted hover:text-foreground'
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
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {lessonProgress.completed ? 'Completed' : 'Mark complete'}
            </button>
          </div>
        </div>

        {/* Sandboxed HTML Article Frame */}
        <div className="rounded-xl overflow-hidden border border-border bg-surface shadow-sm min-h-[60vh] flex flex-col">
          {requiresPermission ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <p className="text-sm text-foreground-muted mb-4">
                Grant folder access to view this HTML lesson.
              </p>
              <button
                onClick={grantPermission}
                className={`px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors ${FOCUS_RING}`}
              >
                Grant access
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : loadError ? (
            <div className="flex-1 flex items-center justify-center p-12 text-sm text-danger">
              {loadError}
            </div>
          ) : (
            <iframe
              title={displayTitle}
              srcDoc={srcDoc}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-[70vh] border-0 bg-surface"
            />
          )}
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={prevLesson}
            disabled={!hasPrev}
            aria-label="Previous lesson"
            title="Previous lesson"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${FOCUS_RING} ${
              hasPrev
                ? 'bg-surface hover:bg-surface-hover border border-border text-foreground hover:border-foreground-subtle'
                : 'bg-surface/50 border border-border/50 text-foreground-subtle cursor-not-allowed'
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center justify-center flex-1">
            <span className="text-xs text-foreground-subtle font-mono">
              {currentIdx >= 0 ? `${currentIdx + 1} / ${visibleLessons.length}` : ''}
            </span>
          </div>

          <button
            onClick={nextLesson}
            disabled={!hasNext}
            aria-label="Next lesson"
            title="Next lesson"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${FOCUS_RING} ${
              hasNext
                ? 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
                : 'bg-surface/50 border border-border/50 text-foreground-subtle cursor-not-allowed'
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Inline Notes Section */}
        <div className="mt-8 bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-hover/50">
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground-subtle"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h3 className="font-medium text-foreground">Lesson Notes</h3>
            </div>
            <span
              className={`text-xs font-medium flex items-center gap-1 transition-opacity duration-300 ${
                isSaved ? 'opacity-100 text-success' : 'opacity-0'
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          </div>
          <div className="p-1">
            <textarea
              value={note}
              onChange={(e) => updateNote(e.target.value)}
              aria-label="Lesson notes"
              placeholder="Write your notes here... (Auto-saves as you type)"
              className="w-full min-h-32 p-4 bg-transparent border-none text-sm leading-relaxed text-foreground focus:outline-none focus:ring-0 resize-y placeholder:text-foreground-muted/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
