import { createJsonStore } from '@/app/lib/local-store';

export interface WatchHistoryData {
  /** Local date string (`YYYY-MM-DD`) -> total watched seconds on that day. */
  days: Record<string, number>;
  /** Daily watch goal in minutes. */
  dailyGoalMinutes: number;
}

export const WATCH_HISTORY_KEY = 'foleyo_watch_history';
export const DEFAULT_DAILY_GOAL_MINUTES = 30;
export const MIN_DAILY_GOAL_MINUTES = 5;
export const MAX_DAILY_GOAL_MINUTES = 480;
/** Minimum seconds watched on a day for it to count toward a streak. */
export const STREAK_MIN_SECONDS = 60;

const EMPTY_HISTORY: WatchHistoryData = {
  days: {},
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
};

const store = createJsonStore<WatchHistoryData>(
  'foleyo_watch_history_updated',
  EMPTY_HISTORY,
);

/**
 * Format a Date into a local `YYYY-MM-DD` key.
 */
export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a `YYYY-MM-DD` key into a local midnight Date.
 */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Return a new Date offset by `deltaDays` local calendar days.
 */
export function addDays(date: Date, deltaDays: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export function sanitizeDailyGoalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_DAILY_GOAL_MINUTES;
  return Math.min(
    MAX_DAILY_GOAL_MINUTES,
    Math.max(MIN_DAILY_GOAL_MINUTES, Math.round(minutes)),
  );
}

export function readWatchHistory(): WatchHistoryData {
  const data = store.read(WATCH_HISTORY_KEY);
  return {
    days: data?.days && typeof data.days === 'object' ? data.days : {},
    dailyGoalMinutes:
      typeof data?.dailyGoalMinutes === 'number' &&
      Number.isFinite(data.dailyGoalMinutes)
        ? sanitizeDailyGoalMinutes(data.dailyGoalMinutes)
        : DEFAULT_DAILY_GOAL_MINUTES,
  };
}

/**
 * Record additional watched seconds for a date (defaults to today).
 * Ignores non-positive or non-finite deltas.
 */
export function recordWatchSeconds(
  deltaSeconds: number,
  now: Date = new Date(),
): WatchHistoryData {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return readWatchHistory();
  }
  const current = readWatchHistory();
  const key = toDateKey(now);
  const prev = current.days[key] ?? 0;
  const next: WatchHistoryData = {
    ...current,
    days: {
      ...current.days,
      [key]: Math.round((prev + deltaSeconds) * 10) / 10,
    },
  };
  store.write(WATCH_HISTORY_KEY, next);
  return next;
}

/**
 * Update the user's daily watch goal in minutes.
 */
export function setDailyGoalMinutes(minutes: number): WatchHistoryData {
  const current = readWatchHistory();
  const next: WatchHistoryData = {
    ...current,
    dailyGoalMinutes: sanitizeDailyGoalMinutes(minutes),
  };
  store.write(WATCH_HISTORY_KEY, next);
  return next;
}

/**
 * Reactive hook to subscribe to watch history changes.
 */
export function useWatchHistory(): WatchHistoryData {
  const data = store.useValue(WATCH_HISTORY_KEY);
  return {
    days: data?.days && typeof data.days === 'object' ? data.days : {},
    dailyGoalMinutes:
      typeof data?.dailyGoalMinutes === 'number' &&
      Number.isFinite(data.dailyGoalMinutes)
        ? sanitizeDailyGoalMinutes(data.dailyGoalMinutes)
        : DEFAULT_DAILY_GOAL_MINUTES,
  };
}

export interface WatchStreakStats {
  todaySeconds: number;
  todayMinutes: number;
  dailyGoalMinutes: number;
  dailyGoalProgress: number; // 0-100
  goalMetToday: boolean;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  /** Average seconds watched per active day (last 30 days, or all active days). */
  averageDailySeconds: number;
}

/**
 * Compute streak, today's watch time, daily goal progress, and rolling average
 * daily pace from watch history.
 */
export function computeWatchStreakStats(
  history: WatchHistoryData,
  now: Date = new Date(),
): WatchStreakStats {
  const todayKey = toDateKey(now);
  const todaySeconds = Math.max(0, history.days[todayKey] ?? 0);
  const todayMinutes = Math.floor(todaySeconds / 60);
  const dailyGoalMinutes = sanitizeDailyGoalMinutes(history.dailyGoalMinutes);
  const goalSeconds = dailyGoalMinutes * 60;
  const dailyGoalProgress =
    goalSeconds > 0
      ? Math.min(100, Math.round((todaySeconds / goalSeconds) * 100))
      : 0;
  const goalMetToday = todaySeconds >= goalSeconds;

  // Collect all active days (>= STREAK_MIN_SECONDS)
  const activeKeys = Object.entries(history.days)
    .filter(([, secs]) => secs >= STREAK_MIN_SECONDS)
    .map(([key]) => key)
    .sort();

  const activeSet = new Set(activeKeys);

  // Current streak: count backwards from today; if today isn't active yet,
  // start from yesterday so an ongoing streak stays visible all day.
  let currentStreak = 0;
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeSet.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  while (activeSet.has(toDateKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest streak across all recorded history
  let longestStreak = 0;
  let run = 0;
  let prevDate: Date | null = null;
  for (const key of activeKeys) {
    const d = parseDateKey(key);
    if (prevDate) {
      const diffDays = Math.round(
        (d.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDate = d;
  }

  // Average daily watch time across active days in the last 30 days
  // (falling back to all active days if none in the last 30 days).
  const cutoffKey = toDateKey(addDays(now, -29));
  const recentActive = activeKeys.filter((k) => k >= cutoffKey && k <= todayKey);
  const sampleKeys = recentActive.length > 0 ? recentActive : activeKeys;
  const sampleTotal = sampleKeys.reduce(
    (sum, key) => sum + (history.days[key] ?? 0),
    0,
  );
  const averageDailySeconds =
    sampleKeys.length > 0 ? Math.round(sampleTotal / sampleKeys.length) : 0;

  return {
    todaySeconds,
    todayMinutes,
    dailyGoalMinutes,
    dailyGoalProgress,
    goalMetToday,
    currentStreak,
    longestStreak,
    totalActiveDays: activeKeys.length,
    averageDailySeconds,
  };
}

export interface HeatmapCell {
  dateKey: string;
  date: Date;
  seconds: number;
  minutes: number;
  /** 0 = no activity, 1 = <50% goal, 2 = 50-99% goal, 3 = goal met, 4 = 2x+ goal */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Build a GitHub-style calendar grid of `weeks` columns × 7 rows (Sun..Sat),
 * ending on the week containing `now`.
 */
export function buildHeatmapGrid(
  history: WatchHistoryData,
  weeks: number = 16,
  now: Date = new Date(),
): HeatmapCell[][] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toDateKey(today);
  const goalSeconds = sanitizeDailyGoalMinutes(history.dailyGoalMinutes) * 60;

  // End on the Saturday of the current week so columns align Sun..Sat cleanly
  const dayOfWeek = today.getDay(); // 0=Sun .. 6=Sat
  const endOfGrid = addDays(today, 6 - dayOfWeek);
  const startOfGrid = addDays(endOfGrid, -(weeks * 7 - 1));

  const columns: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(startOfGrid, w * 7 + d);
      const dateKey = toDateKey(date);
      const isFuture = date.getTime() > today.getTime();
      const seconds = isFuture ? 0 : Math.max(0, history.days[dateKey] ?? 0);
      const minutes = Math.floor(seconds / 60);

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (seconds >= STREAK_MIN_SECONDS) {
        if (seconds >= goalSeconds * 2) level = 4;
        else if (seconds >= goalSeconds) level = 3;
        else if (seconds >= goalSeconds * 0.5) level = 2;
        else level = 1;
      }

      col.push({
        dateKey,
        date,
        seconds,
        minutes,
        level,
        isToday: dateKey === todayKey,
        isFuture,
      });
    }
    columns.push(col);
  }

  return columns;
}

export interface EstimatedFinish {
  date: Date;
  daysRemaining: number;
  label: string;
  /** Whether the estimate uses actual average watch pace or fell back to daily goal. */
  basis: 'average' | 'goal';
  paceMinutesPerDay: number;
}

/**
 * Estimate course finish date from remaining watch seconds and average daily
 * watch pace (falling back to the user's daily goal if no watch history yet).
 */
export function estimateFinishDate(
  remainingSeconds: number,
  averageDailySeconds: number,
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL_MINUTES,
  now: Date = new Date(),
): EstimatedFinish | null {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    return null;
  }

  const useAverage = averageDailySeconds >= STREAK_MIN_SECONDS;
  const paceSeconds = useAverage
    ? averageDailySeconds
    : sanitizeDailyGoalMinutes(dailyGoalMinutes) * 60;

  if (paceSeconds <= 0) return null;

  const daysRemaining = Math.max(1, Math.ceil(remainingSeconds / paceSeconds));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // If 1 day remaining (can finish within today's session), date is today
  const finishDate = addDays(today, daysRemaining - 1);

  let label: string;
  if (daysRemaining === 1) {
    label = 'Today';
  } else if (daysRemaining === 2) {
    label = 'Tomorrow';
  } else {
    const sameYear = finishDate.getFullYear() === today.getFullYear();
    label = finishDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  }

  return {
    date: finishDate,
    daysRemaining,
    label,
    basis: useAverage ? 'average' : 'goal',
    paceMinutesPerDay: Math.max(1, Math.round(paceSeconds / 60)),
  };
}
