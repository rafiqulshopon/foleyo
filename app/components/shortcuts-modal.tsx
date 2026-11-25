'use client';

import { useEffect } from 'react';
import { useCourse } from '@/app/context/course-context';
import { FOCUS_RING } from '@/app/components/focus-ring';

const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Playback',
    items: [
      ['Space / K', 'Play or pause'],
      ['← / →', 'Seek back / forward 5s'],
      ['↑ / ↓', 'Volume up / down'],
      ['M', 'Mute / unmute'],
      ['< / >', 'Speed − / + 0.05×'],
      ['A', 'Set A–B loop start, then end, then clear'],
      ['Shift + A', 'Clear A–B loop'],
      ['C', 'Toggle captions'],
    ],
  },
  {
    title: 'Navigation & Search',
    items: [
      ['⌘K / Ctrl+K', 'Command palette (jump anywhere)'],
      ['Shift + N', 'Next lesson'],
      ['Shift + P', 'Previous lesson'],
      ['?', 'Open this shortcuts cheat sheet'],
    ],
  },
  {
    title: 'Layout & Study',
    items: [
      ['F', 'Fill window (ideal for split-screen)'],
      ['Shift + F', 'Monitor fullscreen'],
      ['T', 'Toggle transcript & subtitle search'],
      ['N', 'Add timestamped bookmark'],
      ['Esc', 'Close modal / exit fill window'],
    ],
  },
];

export function ShortcutsModal() {
  const { shortcutsOpen, setShortcutsOpen, setTourOpen, course } = useCourse();

  // Global `?` shortcut to open/close cheat sheet (ignored inside inputs)
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && shortcutsOpen) {
        e.preventDefault();
        setShortcutsOpen(false);
        return;
      }
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(!shortcutsOpen);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsOpen, setShortcutsOpen]);

  if (!shortcutsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setShortcutsOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-xs text-accent font-semibold">
              ?
            </kbd>
            <h2 className="text-sm font-semibold text-foreground">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsOpen(false)}
            aria-label="Close shortcuts"
            className={`p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING}`}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                {group.title}
              </h3>
              <dl className="space-y-1.5">
                {group.items.map(([keys, desc]) => (
                  <div
                    key={keys}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <dt className="text-foreground-muted">{desc}</dt>
                    <dd className="shrink-0">
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px] text-foreground whitespace-nowrap">
                        {keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3 text-xs">
          <span className="text-foreground-subtle">
            Player keys work whenever you&apos;re not typing in a text box.
          </span>
          {course && (
            <button
              type="button"
              onClick={() => {
                setShortcutsOpen(false);
                setTourOpen(true);
              }}
              className={`shrink-0 text-accent hover:text-accent-hover font-medium transition-colors ${FOCUS_RING} rounded px-1`}
            >
              Replay tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
