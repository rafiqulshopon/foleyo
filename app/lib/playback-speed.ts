/** Speed choices offered in the player's speed menu and the toolbar. */
export const PLAYBACK_RATE_PRESETS = [
  0.5, 0.75, 1, 1.1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3,
] as const;

export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 4;

/** Step used by the `<` / `>` shortcuts. */
export const PLAYBACK_RATE_STEP = 0.05;

export const GLOBAL_SPEED_KEY = 'foleyo_playback_speed';

/** Clamp to the supported range and round to two decimals. */
export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  const clamped = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
  return Math.round(clamped * 100) / 100;
}

/** Move the rate one fine step up or down. */
export function stepPlaybackRate(
  rate: number,
  direction: 1 | -1,
  step: number = PLAYBACK_RATE_STEP,
): number {
  // Snap to the step grid so stepping up from 1.12 lands on 1.15, not 1.17.
  const units = rate / step;
  const base = direction > 0 ? Math.floor(units + 1e-6) : Math.ceil(units - 1e-6);
  return clampPlaybackRate((base + direction) * step);
}

/** Presets plus the current rate when it's a custom value. */
export function playbackRateOptions(current: number): number[] {
  const presets: number[] = [...PLAYBACK_RATE_PRESETS];
  if (!presets.some((r) => Math.abs(r - current) < 1e-6)) {
    presets.push(current);
    presets.sort((a, b) => a - b);
  }
  return presets;
}

export function formatPlaybackRate(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}

export function readGlobalPlaybackRate(): number {
  try {
    const saved = parseFloat(localStorage.getItem(GLOBAL_SPEED_KEY) ?? '');
    return Number.isFinite(saved) && saved > 0 ? clampPlaybackRate(saved) : 1;
  } catch {
    return 1;
  }
}
