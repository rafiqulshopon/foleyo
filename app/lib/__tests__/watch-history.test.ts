import { describe, it, expect, beforeEach } from 'vitest';
import {
  addDays,
  buildHeatmapGrid,
  computeWatchStreakStats,
  DEFAULT_DAILY_GOAL_MINUTES,
  estimateFinishDate,
  readWatchHistory,
  recordWatchSeconds,
  setDailyGoalMinutes,
  toDateKey,
  type WatchHistoryData,
} from '@/app/lib/watch-history';

beforeEach(() => {
  localStorage.clear();
});

describe('watch-history persistence', () => {
  it('starts with empty days and default daily goal', () => {
    expect(readWatchHistory()).toEqual({
      days: {},
      dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    });
  });

  it('accumulates watched seconds per date key and ignores invalid deltas', () => {
    const day = new Date(2026, 10, 25); // Nov 25, 2026
    recordWatchSeconds(120, day);
    recordWatchSeconds(65.5, day);
    recordWatchSeconds(0, day);
    recordWatchSeconds(-10, day);
    recordWatchSeconds(Number.NaN, day);

    const history = readWatchHistory();
    expect(history.days['2026-11-25']).toBeCloseTo(185.5, 1);
  });

  it('clamps and persists daily goal minutes', () => {
    setDailyGoalMinutes(45);
    expect(readWatchHistory().dailyGoalMinutes).toBe(45);

    setDailyGoalMinutes(1);
    expect(readWatchHistory().dailyGoalMinutes).toBe(5);

    setDailyGoalMinutes(999);
    expect(readWatchHistory().dailyGoalMinutes).toBe(480);
  });
});

describe('computeWatchStreakStats', () => {
  const today = new Date(2026, 10, 25);

  it('computes active streak ending today and daily goal progress', () => {
    const history: WatchHistoryData = {
      dailyGoalMinutes: 30,
      days: {
        [toDateKey(addDays(today, -2))]: 1200, // 20m
        [toDateKey(addDays(today, -1))]: 2400, // 40m
        [toDateKey(today)]: 2520, // 42m
      },
    };

    const stats = computeWatchStreakStats(history, today);
    expect(stats.todayMinutes).toBe(42);
    expect(stats.dailyGoalProgress).toBe(100);
    expect(stats.goalMetToday).toBe(true);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    expect(stats.totalActiveDays).toBe(3);
    expect(stats.averageDailySeconds).toBe(Math.round((1200 + 2400 + 2520) / 3));
  });

  it('keeps an ongoing streak alive if yesterday was active and today is not yet watched', () => {
    const history: WatchHistoryData = {
      dailyGoalMinutes: 30,
      days: {
        [toDateKey(addDays(today, -3))]: 600,
        [toDateKey(addDays(today, -2))]: 600,
        [toDateKey(addDays(today, -1))]: 600,
      },
    };

    const stats = computeWatchStreakStats(history, today);
    expect(stats.todaySeconds).toBe(0);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('breaks current streak when both today and yesterday are inactive, while preserving longest streak', () => {
    const history: WatchHistoryData = {
      dailyGoalMinutes: 30,
      days: {
        [toDateKey(addDays(today, -6))]: 900,
        [toDateKey(addDays(today, -5))]: 900,
        [toDateKey(addDays(today, -4))]: 900,
        [toDateKey(addDays(today, -3))]: 900,
      },
    };

    const stats = computeWatchStreakStats(history, today);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(4);
  });
});

describe('buildHeatmapGrid', () => {
  it('builds a weeks × 7 grid with intensity levels and today marker', () => {
    const today = new Date(2026, 10, 25); // Wednesday
    const history: WatchHistoryData = {
      dailyGoalMinutes: 30, // 1800s goal
      days: {
        [toDateKey(addDays(today, -3))]: 300, // level 1 (<50%)
        [toDateKey(addDays(today, -2))]: 1000, // level 2 (50-99%)
        [toDateKey(addDays(today, -1))]: 1800, // level 3 (goal met)
        [toDateKey(today)]: 4000, // level 4 (2x+ goal)
      },
    };

    const grid = buildHeatmapGrid(history, 4, today);
    expect(grid).toHaveLength(4);
    expect(grid.every((col) => col.length === 7)).toBe(true);

    const flat = grid.flat();
    const byKey = new Map(flat.map((c) => [c.dateKey, c]));
    expect(byKey.get(toDateKey(today))?.isToday).toBe(true);
    expect(byKey.get(toDateKey(today))?.level).toBe(4);
    expect(byKey.get(toDateKey(addDays(today, -1)))?.level).toBe(3);
    expect(byKey.get(toDateKey(addDays(today, -2)))?.level).toBe(2);
    expect(byKey.get(toDateKey(addDays(today, -3)))?.level).toBe(1);
    expect(byKey.get(toDateKey(addDays(today, 1)))?.isFuture).toBe(true);
  });
});

describe('estimateFinishDate', () => {
  const today = new Date(2026, 10, 25);

  it('returns null when nothing remains', () => {
    expect(estimateFinishDate(0, 1800, 30, today)).toBeNull();
  });

  it('uses average daily watch time when available', () => {
    // 3600s left at 1800s/day -> 2 days -> Tomorrow
    const est = estimateFinishDate(3600, 1800, 60, today);
    expect(est).not.toBeNull();
    expect(est!.basis).toBe('average');
    expect(est!.daysRemaining).toBe(2);
    expect(est!.label).toBe('Tomorrow');
    expect(est!.paceMinutesPerDay).toBe(30);
  });

  it('falls back to daily goal when there is no watch history yet', () => {
    // 9000s (150m) left at 30m/day goal -> 5 days
    const est = estimateFinishDate(9000, 0, 30, today);
    expect(est).not.toBeNull();
    expect(est!.basis).toBe('goal');
    expect(est!.daysRemaining).toBe(5);
    expect(est!.label).toBe('Nov 29');
  });

  it('returns Today when remaining time fits in a single session', () => {
    const est = estimateFinishDate(600, 1800, 30, today);
    expect(est?.label).toBe('Today');
    expect(est?.daysRemaining).toBe(1);
  });
});
