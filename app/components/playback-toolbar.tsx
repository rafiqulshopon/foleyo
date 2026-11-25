"use client";

import { useState } from "react";
import {
  PLAYBACK_RATE_PRESETS,
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  clampPlaybackRate,
  formatPlaybackRate,
} from "@/app/lib/playback-speed";
import { MAX_SKIP_SECONDS } from "@/app/lib/course-settings";
import { formatTimestamp } from "@/app/lib/time";
import { FOCUS_RING } from "@/app/components/focus-ring";

export interface LoopRange {
  a: number | null;
  b: number | null;
}

const SHORTCUTS: [string, string][] = [
  ["N", "Bookmark current second"],
  ["Shift + N / Shift + P", "Next / previous lesson"],
  ["A", "Set loop start, then end; again to clear"],
  ["Shift + A", "Clear loop"],
  ["< / >", "Speed −/+ 0.05×"],
  ["Space / K", "Play / pause"],
  ["← / →", "Seek 5s"],
  ["F / Shift + F", "Fill window / monitor fullscreen"],
  ["C", "Toggle captions"],
];

const fieldClass =
  "h-8 rounded-lg bg-background border border-border text-xs text-foreground px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Compact row of per-course playback controls under the player: speed
 * presets with a custom value, intro/outro skip, and the A–B loop.
 */
export function PlaybackToolbar({
  courseName,
  playbackRate,
  onRateChange,
  introSkip,
  outroSkip,
  onIntroSkipChange,
  onOutroSkipChange,
  loop,
  onLoopStep,
  onLoopClear,
}: {
  courseName: string;
  playbackRate: number;
  onRateChange: (rate: number) => void;
  introSkip: number;
  outroSkip: number;
  onIntroSkipChange: (seconds: number) => void;
  onOutroSkipChange: (seconds: number) => void;
  loop: LoopRange;
  onLoopStep: () => void;
  onLoopClear: () => void;
}) {
  const isPreset = PLAYBACK_RATE_PRESETS.some(
    (r) => Math.abs(r - playbackRate) < 1e-6,
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const showCustom = customOpen || !isPreset;

  const loopLabel =
    loop.a === null
      ? "Set A"
      : loop.b === null
        ? `A ${formatTimestamp(loop.a)} → set B`
        : `${formatTimestamp(loop.a)} → ${formatTimestamp(loop.b)}`;
  const loopActive = loop.a !== null && loop.b !== null;

  return (
    <div className="mt-4 bg-surface border border-border rounded-xl px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-foreground-subtle">
        {/* Speed */}
        <div className="flex items-center gap-2">
          <label htmlFor="speed-select" className="font-medium">
            Speed
          </label>
          <select
            id="speed-select"
            value={showCustom ? "custom" : String(playbackRate)}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setCustomOpen(true);
              } else {
                setCustomOpen(false);
                onRateChange(Number(e.target.value));
              }
            }}
            className={fieldClass}
            title={`Remembered for ${courseName}`}
          >
            {PLAYBACK_RATE_PRESETS.map((rate) => (
              <option key={rate} value={String(rate)}>
                {formatPlaybackRate(rate)}
              </option>
            ))}
            <option value="custom">
              {isPreset ? "Custom…" : `Custom (${formatPlaybackRate(playbackRate)})`}
            </option>
          </select>
          {showCustom && (
            <input
              key={playbackRate}
              type="number"
              aria-label="Custom playback speed"
              min={MIN_PLAYBACK_RATE}
              max={MAX_PLAYBACK_RATE}
              step={0.05}
              defaultValue={playbackRate}
              autoFocus={customOpen && isPreset}
              onBlur={(e) => commitRate(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRate(e.currentTarget.value);
              }}
              className={`${fieldClass} w-20`}
            />
          )}
        </div>

        {/* Intro / outro skip */}
        <SkipField
          key={`intro-${courseName}-${introSkip}`}
          id="intro-skip"
          label="Skip intro"
          title="Start every lesson in this course this many seconds in"
          value={introSkip}
          onCommit={onIntroSkipChange}
        />
        <SkipField
          key={`outro-${courseName}-${outroSkip}`}
          id="outro-skip"
          label="Skip outro"
          title="Treat a lesson as finished this many seconds before its end"
          value={outroSkip}
          onCommit={onOutroSkipChange}
        />

        {/* A–B loop */}
        <div className="flex items-center gap-1.5">
          <span className="font-medium">A–B loop</span>
          <button
            type="button"
            onClick={onLoopStep}
            aria-pressed={loopActive}
            title="Set loop start, then end (A)"
            className={`h-8 px-2.5 rounded-lg border font-mono transition-colors ${FOCUS_RING} ${
              loopActive
                ? "bg-accent text-white border-accent"
                : loop.a !== null
                  ? "bg-accent/10 text-accent border-accent/30"
                  : "bg-background border-border text-foreground hover:border-foreground-subtle"
            }`}
          >
            {loopLabel}
          </button>
          {loop.a !== null && (
            <button
              type="button"
              onClick={onLoopClear}
              aria-label="Clear A–B loop"
              title="Clear loop (Shift+A)"
              className={`h-8 w-8 flex items-center justify-center rounded-lg text-foreground-subtle hover:text-foreground hover:bg-surface-hover ${FOCUS_RING}`}
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
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowShortcuts((v) => !v)}
          aria-expanded={showShortcuts}
          className={`ml-auto h-8 px-2.5 rounded-lg hover:bg-surface-hover hover:text-foreground transition-colors ${FOCUS_RING}`}
        >
          Shortcuts
        </button>
      </div>

      {showShortcuts && (
        <dl className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between gap-3">
              <dt className="text-foreground-subtle">{desc}</dt>
              <dd>
                <kbd className="px-1.5 py-0.5 rounded border border-border font-mono text-[11px] text-foreground whitespace-nowrap">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  function commitRate(raw: string) {
    const value = parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    const rate = clampPlaybackRate(value);
    if (Math.abs(rate - playbackRate) > 1e-6) onRateChange(rate);
  }
}

function SkipField({
  id,
  label,
  title,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  title: string;
  value: number;
  onCommit: (seconds: number) => void;
}) {
  const commit = (raw: string) => {
    const seconds = raw.trim() === "" ? 0 : Number(raw);
    if (Number.isFinite(seconds) && seconds !== value) onCommit(seconds);
  };
  return (
    <div className="flex items-center gap-2" title={title}>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={0}
          max={MAX_SKIP_SECONDS}
          step={1}
          defaultValue={value || ""}
          placeholder="0"
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
          }}
          className={`${fieldClass} w-16 pr-5`}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted">
          s
        </span>
      </div>
    </div>
  );
}
