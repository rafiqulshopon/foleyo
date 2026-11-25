'use client';

import { useEffect, useState } from 'react';
import { useCourse } from '@/app/context/course-context';
import { FOCUS_RING } from '@/app/components/focus-ring';

export const TOUR_STORAGE_KEY = 'foleyo_tour_completed';

const TOUR_STEPS = [
  {
    badge: '1 / 4 · Layout',
    title: 'Fill-window mode for split-screen study',
    description:
      'Press F (or the corner expand icon on the player) to fill just your browser window — perfect when taking notes or coding side-by-side. Use Shift+F for full monitor fullscreen.',
    keys: ['F', 'Shift + F'],
  },
  {
    badge: '2 / 4 · Study',
    title: 'Timestamped bookmarks & auto-saving notes',
    description:
      'Press N at any moment to drop a timestamped bookmark. Write lesson notes right below the video, and export them by course or module to Markdown, Obsidian, or Notion.',
    keys: ['N'],
  },
  {
    badge: '3 / 4 · Search',
    title: 'Jump anywhere with ⌘K & Transcript search',
    description:
      'Press ⌘K (or Ctrl+K) to jump to any lesson, course, or setting. Press T to open the synced transcript panel and search spoken words across every subtitled lesson.',
    keys: ['⌘K', 'T'],
  },
  {
    badge: '4 / 4 · Shortcuts & Backup',
    title: 'Press ? anytime for shortcuts — and back up your data',
    description:
      'Press ? anytime to pull up the full keyboard cheat sheet. Everything stays local in your browser, and you can export a JSON backup or sync a .foleyo.json file into your course folder.',
    keys: ['?'],
  },
];

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function hasCompletedTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

export function OnboardingTour() {
  const { course, tourOpen, setTourOpen } = useCourse();
  const [step, setStep] = useState(0);

  // Auto-open the first time a user enters a course
  useEffect(() => {
    if (!course) return;
    if (!hasCompletedTour()) {
      setTourOpen(true);
    }
  }, [course, setTourOpen]);

  const finish = () => {
    markTourCompleted();
    setTourOpen(false);
    setStep(0);
  };

  useEffect(() => {
    if (!tourOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        markTourCompleted();
        setTourOpen(false);
        setStep(0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStep((s) => Math.min(TOUR_STEPS.length - 1, s + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tourOpen, setTourOpen]);

  if (!tourOpen) return null;

  const current = TOUR_STEPS[step] ?? TOUR_STEPS[0];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick tour of Foleyo"
      onClick={finish}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent font-semibold">
            {current.badge}
          </span>
          <button
            type="button"
            onClick={finish}
            className={`text-xs text-foreground-subtle hover:text-foreground transition-colors ${FOCUS_RING} rounded px-1.5 py-0.5`}
          >
            Skip
          </button>
        </div>

        <h2 className="mt-2.5 text-base font-semibold text-foreground">
          {current.title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
          {current.description}
        </p>

        <div className="mt-4 flex items-center gap-1.5">
          {current.keys.map((k) => (
            <kbd
              key={k}
              className="px-2 py-1 rounded-md border border-border bg-background font-mono text-[11px] text-foreground"
            >
              {k}
            </kbd>
          ))}
        </div>

        {/* Step dots + navigation */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === step ? 'w-5 bg-accent' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className={`px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING}`}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) finish();
                else setStep((s) => s + 1);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors ${FOCUS_RING}`}
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
