'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildHeatmapGrid,
  computeWatchStreakStats,
  estimateFinishDate,
  setDailyGoalMinutes,
  useWatchHistory,
  type HeatmapCell,
} from '@/app/lib/watch-history';
import { formatDuration } from '@/app/lib/time';
import { FOCUS_RING } from '@/app/components/focus-ring';

const GOAL_PRESETS = [15, 30, 45, 60, 90];

const LEVEL_CLASSES: Record<HeatmapCell['level'], string> = {
  0: 'bg-border-subtle/70',
  1: 'bg-success/25',
  2: 'bg-success/50',
  3: 'bg-success/80',
  4: 'bg-success',
};

const DAY_LABELS: [number, string][] = [
  [1, 'Mon'],
  [3, 'Wed'],
  [5, 'Fri'],
];

function formatCellTooltip(cell: HeatmapCell): string {
  const dateLabel = cell.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (cell.seconds <= 0) return `${dateLabel} — No watch time`;
  return `${dateLabel} — Watched ${formatDuration(cell.seconds)}`;
}

export function WatchActivityCard({
  courseRemainingSeconds = 0,
  moduleRemainingSeconds = 0,
  moduleTitle,
  weeks = 16,
  compact = false,
}: {
  courseRemainingSeconds?: number;
  moduleRemainingSeconds?: number;
  moduleTitle?: string;
  weeks?: number;
  compact?: boolean;
}) {
  const history = useWatchHistory();
  const [editingGoal, setEditingGoal] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const stats = useMemo(() => computeWatchStreakStats(history), [history]);
  const grid = useMemo(
    () => buildHeatmapGrid(history, weeks),
    [history, weeks],
  );

  const eta = useMemo(
    () =>
      estimateFinishDate(
        courseRemainingSeconds,
        stats.averageDailySeconds,
        stats.dailyGoalMinutes,
      ),
    [courseRemainingSeconds, stats.averageDailySeconds, stats.dailyGoalMinutes],
  );

  // Month labels placed above the first column where each month appears
  const monthLabels = useMemo(() => {
    const labels: { colIndex: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((col, colIndex) => {
      const firstReal = col.find((c) => !c.isFuture) ?? col[0];
      const m = firstReal.date.getMonth();
      if (m !== lastMonth) {
        labels.push({
          colIndex,
          label: firstReal.date.toLocaleDateString('en-US', { month: 'short' }),
        });
        lastMonth = m;
      }
    });
    return labels;
  }, [grid]);

  const watchedTodayText =
    stats.todaySeconds > 0
      ? `Watched ${formatDuration(stats.todaySeconds)} today`
      : 'No watch time yet today';

  return (
    <div
      className={
        compact
          ? 'space-y-4'
          : 'rounded-xl border border-border bg-surface p-5 space-y-5'
      }
    >
      {/* Top metrics row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold text-foreground">
              {watchedTodayText}
            </span>
            {stats.goalMetToday && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Goal met
              </span>
            )}
          </div>

          {/* Daily goal bar */}
          <div className="flex items-center gap-3 max-w-sm">
            <div
              className="flex-1 h-2 rounded-full bg-border overflow-hidden"
              role="progressbar"
              aria-label="Daily watch goal progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.dailyGoalProgress}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  stats.goalMetToday ? 'bg-success' : 'bg-accent'
                }`}
                style={{ width: `${stats.dailyGoalProgress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setEditingGoal((v) => !v)}
              className={`shrink-0 font-mono text-[11px] text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING} rounded px-1`}
              title="Change daily watch goal"
            >
              {stats.todayMinutes} / {stats.dailyGoalMinutes}m goal
            </button>
          </div>

          {editingGoal && (
            <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-foreground-subtle mr-1">
                Daily goal:
              </span>
              {GOAL_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDailyGoalMinutes(mins);
                    setEditingGoal(false);
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] border transition-colors ${FOCUS_RING} ${
                    stats.dailyGoalMinutes === mins
                      ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                      : 'bg-background border-border text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {mins}m
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={480}
                defaultValue={stats.dailyGoalMinutes}
                aria-label="Custom daily goal in minutes"
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value);
                  if (Number.isFinite(v) && v >= 5) {
                    setDailyGoalMinutes(v);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = Number(e.currentTarget.value);
                    if (Number.isFinite(v) && v >= 5) {
                      setDailyGoalMinutes(v);
                    }
                    setEditingGoal(false);
                  } else if (e.key === 'Escape') {
                    setEditingGoal(false);
                  }
                }}
                className="w-16 h-6 rounded-md bg-background border border-border px-1.5 font-mono text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          )}
        </div>

        {/* Streak & pace stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 font-mono text-base font-semibold text-foreground">
              <span
                className={
                  stats.currentStreak > 0
                    ? 'text-warning'
                    : 'text-foreground-subtle'
                }
                aria-hidden="true"
              >
                🔥
              </span>
              <span>{stats.currentStreak}</span>
              <span className="text-xs font-normal text-foreground-muted">
                {stats.currentStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-subtle">
              Streak{stats.longestStreak > stats.currentStreak ? ` · Best ${stats.longestStreak}d` : ''}
            </p>
          </div>

          {stats.averageDailySeconds >= 60 && (
            <div className="text-right border-l border-border pl-4">
              <div className="font-mono text-base font-semibold text-foreground">
                {formatDuration(stats.averageDailySeconds)}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-foreground-subtle">
                Daily avg
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Course ETA & Module remaining strip (when inside a course) */}
      {(eta || moduleRemainingSeconds > 0) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-background/60 border border-border-subtle px-3.5 py-2.5 text-xs">
          {moduleRemainingSeconds > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-foreground-subtle">
                {moduleTitle ? `${moduleTitle}:` : 'Current module:'}
              </span>
              <span className="font-mono font-medium text-foreground">
                {formatDuration(moduleRemainingSeconds)} left
              </span>
            </div>
          )}
          {eta && (
            <div className="flex items-center gap-1.5">
              <span className="text-foreground-subtle">Est. finish:</span>
              <span className="font-mono font-medium text-accent">
                {eta.label}
              </span>
              <span className="text-[11px] text-foreground-subtle">
                ({eta.paceMinutesPerDay}m/day{' '}
                {eta.basis === 'average' ? 'avg' : 'goal'})
              </span>
            </div>
          )}
        </div>
      )}

      {/* GitHub-style calendar heatmap */}
      <div className="space-y-1.5">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col gap-1 min-w-max">
            {/* Month labels row */}
            <div className="flex items-center pl-7 text-[10px] font-mono text-foreground-subtle h-3.5 relative">
              {monthLabels.map(({ colIndex, label }) => (
                <span
                  key={`${colIndex}-${label}`}
                  style={{ left: `${28 + colIndex * 15}px` }}
                  className="absolute top-0"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Grid body */}
            <div className="flex gap-1">
              {/* Weekday labels */}
              <div className="w-6 flex flex-col justify-between py-0.5 text-[9px] font-mono text-foreground-subtle select-none">
                {[0, 1, 2, 3, 4, 5, 6].map((row) => {
                  const found = DAY_LABELS.find(([idx]) => idx === row);
                  return (
                    <span key={row} className="h-[11px] leading-[11px]">
                      {found ? found[1] : ''}
                    </span>
                  );
                })}
              </div>

              {/* Week columns */}
              <div className="flex gap-[4px]" role="grid" aria-label="Watch activity calendar">
                {grid.map((col, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[4px]" role="row">
                    {col.map((cell) => (
                      <div
                        key={cell.dateKey}
                        role="gridcell"
                        title={cell.isFuture ? '' : formatCellTooltip(cell)}
                        onMouseEnter={() => {
                          if (!cell.isFuture) setHoveredCell(cell);
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`w-[11px] h-[11px] rounded-[2px] transition-transform ${
                          cell.isFuture
                            ? 'bg-transparent'
                            : `${LEVEL_CLASSES[cell.level]} hover:scale-125`
                        } ${
                          cell.isToday
                            ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface'
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: hovered cell info + legend */}
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-foreground-subtle">
          <span className="truncate">
            {hoveredCell
              ? formatCellTooltip(hoveredCell)
              : `${stats.totalActiveDays} active ${
                  stats.totalActiveDays === 1 ? 'day' : 'days'
                } recorded`}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span>Less</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`w-[9px] h-[9px] rounded-[2px] ${LEVEL_CLASSES[lvl]}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WatchActivityModal({
  open,
  onClose,
  courseRemainingSeconds = 0,
  moduleRemainingSeconds = 0,
  moduleTitle,
}: {
  open: boolean;
  onClose: () => void;
  courseRemainingSeconds?: number;
  moduleRemainingSeconds?: number;
  moduleTitle?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Watch activity and daily streak"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Watch Activity &amp; Daily Goal
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close watch activity"
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

        <WatchActivityCard
          compact
          weeks={20}
          courseRemainingSeconds={courseRemainingSeconds}
          moduleRemainingSeconds={moduleRemainingSeconds}
          moduleTitle={moduleTitle}
        />
      </div>
    </div>
  );
}
