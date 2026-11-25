import type { SubtitleInfo } from '@/app/types';
import { parseTimestamp } from '@/app/lib/time';

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Friendly labels for common subtitle language codes.
 */
export const SUBTITLE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
};

/**
 * Map a subtitle language code to a display label, falling back to uppercase.
 */
export function getSubtitleLabel(language: string): string {
  const label = SUBTITLE_LABELS[language] || language.toUpperCase();
  return label === 'UNKNOWN' ? 'Default' : label;
}

/**
 * Deduplicate subtitle tracks by language, preferring VTT over SRT.
 */
export function dedupeSubtitles(subtitles: SubtitleInfo[]): SubtitleInfo[] {
  const map = new Map<string, SubtitleInfo>();
  subtitles.forEach((sub) => {
    const existing = map.get(sub.language);
    if (!existing || sub.format === 'vtt') {
      map.set(sub.language, sub);
    }
  });
  return Array.from(map.values());
}

/**
 * Convert SRT (SubRip Text) to WebVTT format.
 * WebVTT requires a "WEBVTT" header and uses '.' instead of ',' for milliseconds.
 */
export function convertSrtToVtt(srtContent: string): string {
  let vtt = 'WEBVTT\n\n';
  
  // Replace all ',' with '.' in the timestamp lines
  // SRT timestamp format: 00:00:01,000 --> 00:00:04,000
  // VTT timestamp format: 00:00:01.000 --> 00:00:04.000
  
  const lines = srtContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line is a timestamp line (contains -->)
    if (line.includes('-->')) {
      vtt += line.replace(/,/g, '.') + '\n';
    } else {
      vtt += line + '\n';
    }
  }
  
  return vtt;
}

/**
 * Strip VTT/HTML cue tags (e.g. `<i>`, `<c.color>`, `<00:01:02.000>`) and decode
 * common HTML entities so transcript text is clean and searchable.
 */
function cleanCueText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse WebVTT (or converted SRT) text into ordered, searchable SubtitleCue items.
 * Handles `HH:MM:SS.mmm`, `MM:SS.mmm`, cue settings after end timestamp,
 * optional cue identifiers, and skips WEBVTT/NOTE/STYLE/REGION headers.
 */
export function parseVttCues(vttContent: string): SubtitleCue[] {
  const normalized = vttContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const rawBlock of blocks) {
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    // Skip WebVTT metadata blocks
    const first = lines[0];
    if (
      first.startsWith('WEBVTT') ||
      first.startsWith('NOTE') ||
      first.startsWith('STYLE') ||
      first.startsWith('REGION')
    ) {
      continue;
    }

    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx];
    const [rawStart, rawRest] = timingLine.split('-->');
    if (!rawStart || !rawRest) continue;

    // End timestamp may be followed by VTT cue settings (e.g. "align:start")
    const rawEnd = rawRest.trim().split(/\s+/)[0];
    const startTime = parseTimestamp(rawStart.trim());
    const endTime = parseTimestamp(rawEnd);
    if (startTime === null || endTime === null) continue;

    const text = cleanCueText(lines.slice(timingIdx + 1).join(' '));
    if (!text) continue;

    cues.push({
      id: `${startTime.toFixed(3)}-${cues.length}`,
      startTime,
      endTime: Math.max(endTime, startTime),
      text,
    });
  }

  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

/**
 * Find the index of the active subtitle cue for a given playback time.
 * Uses binary search for O(log n) lookup during timeupdate ticks.
 * Returns -1 if no cue is active at `currentTime`.
 */
export function findActiveCueIndex(
  cues: SubtitleCue[],
  currentTime: number
): number {
  if (cues.length === 0 || !Number.isFinite(currentTime)) return -1;

  let lo = 0;
  let hi = cues.length - 1;
  let candidate = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].startTime <= currentTime + 0.05) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (candidate === -1) return -1;
  const cue = cues[candidate];
  if (currentTime <= cue.endTime + 0.15) return candidate;
  return -1;
}

/**
 * Search parsed subtitle cues with a case-insensitive multi-term query.
 * Every whitespace-separated term must match somewhere in the cue text.
 */
export function searchSubtitleCues(
  cues: SubtitleCue[],
  query: string
): SubtitleCue[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return cues;

  return cues.filter((cue) => {
    const lower = cue.text.toLowerCase();
    return terms.every((t) => lower.includes(t));
  });
}

/**
 * Reads a subtitle file, converts to VTT if necessary, parses its cues,
 * and returns both the Object URL and parsed cues.
 */
export async function loadSubtitleWithCues(
  handle: FileSystemFileHandle,
  format: 'srt' | 'vtt'
): Promise<{ src: string; cues: SubtitleCue[] }> {
  const file = await handle.getFile();
  let text = await file.text();

  if (format === 'srt') {
    text = convertSrtToVtt(text);
  }

  const cues = parseVttCues(text);
  const blob = new Blob([text], { type: 'text/vtt' });
  return { src: URL.createObjectURL(blob), cues };
}

/**
 * Reads a subtitle file, converts to VTT if necessary, and returns an Object URL.
 */
export async function loadSubtitle(
  handle: FileSystemFileHandle,
  format: 'srt' | 'vtt'
): Promise<string> {
  const { src } = await loadSubtitleWithCues(handle, format);
  return src;
}

/**
 * Parse cues directly from a subtitle file handle without creating an Object URL.
 * Useful for cross-lesson subtitle search without leaking blob URLs.
 */
export async function readSubtitleCues(
  handle: FileSystemFileHandle,
  format: 'srt' | 'vtt'
): Promise<SubtitleCue[]> {
  const file = await handle.getFile();
  let text = await file.text();
  if (format === 'srt') {
    text = convertSrtToVtt(text);
  }
  return parseVttCues(text);
}

export const CC_ENABLED_KEY = 'foleyo_cc_enabled';
export const CC_LANGUAGE_KEY = 'foleyo_cc_language';

export interface CaptionPreference {
  enabled: boolean;
  language: string | null;
}

export function readCaptionPreference(): CaptionPreference {
  try {
    return {
      enabled: localStorage.getItem(CC_ENABLED_KEY) !== 'false',
      language: localStorage.getItem(CC_LANGUAGE_KEY),
    };
  } catch {
    return { enabled: true, language: null };
  }
}

/**
 * Persist a caption selection change. `null` means captions were turned off;
 * the last language is kept so turning them back on restores it.
 */
export function saveCaptionPreference(language: string | null) {
  try {
    localStorage.setItem(CC_ENABLED_KEY, String(language !== null));
    if (language !== null) localStorage.setItem(CC_LANGUAGE_KEY, language);
  } catch {
    // storage unavailable — preference just won't persist
  }
}

/**
 * Choose which subtitle track (by language) should start enabled: the last
 * language the user picked, else English, else the only track. Returns null
 * when captions are off or nothing suitable exists.
 */
export function pickDefaultSubtitle(
  tracks: { language: string }[],
  pref: CaptionPreference
): string | null {
  if (!pref.enabled || tracks.length === 0) return null;
  if (pref.language && tracks.some((t) => t.language === pref.language)) {
    return pref.language;
  }
  if (tracks.some((t) => t.language === 'en')) return 'en';
  return tracks.length === 1 ? tracks[0].language : null;
}
