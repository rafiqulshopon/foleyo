/**
 * Client-side seek-bar thumbnail storyboard generator for Vidstack.
 * Captures frames from an offscreen <video> into a single sprite <canvas>
 * and returns a Vidstack-compatible ThumbnailStoryboard object.
 */

export interface ThumbnailTile {
  startTime: number;
  x: number;
  y: number;
}

export interface ThumbnailStoryboard {
  url: string;
  tileWidth: number;
  tileHeight: number;
  tiles: ThumbnailTile[];
}

const TILE_WIDTH = 160;
const TILE_HEIGHT = 90;
const SPRITE_COLS = 6;
const MAX_FRAMES = 36;
const MIN_FRAMES = 4;

/**
 * Choose frame timestamps evenly spaced across `duration` (seconds).
 * Pure helper — easy to unit test.
 */
export function computeThumbnailTimestamps(duration: number): number[] {
  if (!Number.isFinite(duration) || duration < 4) return [];

  // Target ~1 frame every 10s, clamped between MIN_FRAMES and MAX_FRAMES
  const count = Math.min(
    MAX_FRAMES,
    Math.max(MIN_FRAMES, Math.floor(duration / 10)),
  );
  const step = duration / count;
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    // Capture near the start of each bucket (avoiding exact 0.0 black frames)
    const t = i === 0 ? Math.min(1, step * 0.25) : i * step;
    times.push(Math.round(t * 100) / 100);
  }
  return times;
}

function waitForEvent(
  el: HTMLElement,
  event: string,
  signal: AbortSignal,
  timeoutMs = 4000,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(event, onSuccess);
      el.removeEventListener('error', onFail);
      signal.removeEventListener('abort', onFail);
    };

    const onSuccess = () => {
      cleanup();
      resolve(true);
    };
    const onFail = () => {
      cleanup();
      resolve(false);
    };

    const timer = setTimeout(onFail, timeoutMs);
    el.addEventListener(event, onSuccess, { once: true });
    el.addEventListener('error', onFail, { once: true });
    signal.addEventListener('abort', onFail, { once: true });
  });
}

/**
 * Generate a seek-bar thumbnail sprite sheet for a video object URL.
 * Caller is responsible for calling `URL.revokeObjectURL(storyboard.url)`
 * when switching videos or unmounting.
 */
export async function generateSeekThumbnailStoryboard(
  videoUrl: string,
  duration: number,
  signal: AbortSignal,
): Promise<ThumbnailStoryboard | null> {
  if (typeof document === 'undefined' || signal.aborted) return null;

  const timestamps = computeThumbnailTimestamps(duration);
  if (timestamps.length === 0) return null;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = videoUrl;

  const cleanupVideo = () => {
    video.removeAttribute('src');
    video.load();
  };

  try {
    const loaded = await waitForEvent(video, 'loadeddata', signal, 6000);
    if (!loaded || signal.aborted) {
      cleanupVideo();
      return null;
    }

    const cols = Math.min(SPRITE_COLS, timestamps.length);
    const rows = Math.ceil(timestamps.length / cols);
    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_WIDTH;
    canvas.height = rows * TILE_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cleanupVideo();
      return null;
    }

    const tiles: ThumbnailTile[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (signal.aborted) {
        cleanupVideo();
        return null;
      }

      const startTime = timestamps[i];
      video.currentTime = Math.min(startTime, Math.max(0, duration - 0.2));
      const seeked = await waitForEvent(video, 'seeked', signal, 3000);
      if (!seeked || signal.aborted) {
        if (signal.aborted) {
          cleanupVideo();
          return null;
        }
        continue;
      }

      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * TILE_WIDTH;
      const y = row * TILE_HEIGHT;

      try {
        ctx.drawImage(video, x, y, TILE_WIDTH, TILE_HEIGHT);
        tiles.push({ startTime: i === 0 ? 0 : startTime, x, y });
      } catch {
        // Ignore frame draw failures
      }
    }

    cleanupVideo();

    if (tiles.length === 0 || signal.aborted) return null;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.65);
    });
    if (!blob || signal.aborted) return null;

    return {
      url: URL.createObjectURL(blob),
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      tiles,
    };
  } catch {
    cleanupVideo();
    return null;
  }
}
