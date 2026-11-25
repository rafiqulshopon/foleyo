/**
 * Format seconds as `m:ss`, or `h:mm:ss` once past an hour.
 */
export function formatTimestamp(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Parse `ss`, `m:ss`, `mm:ss` or `h:mm:ss` (optional `.fraction` on seconds)
 * into seconds. Returns null for anything malformed or out of range.
 */
export function parseTimestamp(input: string): number | null {
  const match = input.trim().match(/^(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2})(?:[.,](\d+))?$/);
  if (!match) return null;
  const [, a, b, c, frac] = match;
  let hours = 0;
  let minutes = 0;
  if (a !== undefined && b !== undefined) {
    hours = Number(a);
    minutes = Number(b);
    if (minutes >= 60) return null;
  } else if (a !== undefined) {
    minutes = Number(a);
  }
  const seconds = Number(c);
  if (seconds >= 60 && (a !== undefined || b !== undefined)) return null;
  const fraction = frac ? Number(`0.${frac}`) : 0;
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

/**
 * Format seconds into a compact human-readable duration (e.g. `42m`, `1h 15m`, `<1m`).
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';
  if (totalSeconds < 60) return '<1m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
