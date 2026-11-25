import { parseTimestamp } from '@/app/lib/time';

export interface Chapter {
  start: number; // seconds
  title: string;
}

export interface ChapterCue {
  startTime: number;
  endTime: number;
  text: string;
}

// A timestamp token: m:ss, mm:ss or h:mm:ss, optionally wrapped in [] or ().
const TS = String.raw`[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?`;
const BULLET = String.raw`(?:[-*•–]\s+|\d+[.)]\s+(?=[\[(]?\d))?`;
const SEP = String.raw`(?:\s*[-–—:|.)]\s*|\s+)`;

// "00:00 Intro", "- [1:02:03] - Setup", "3. 05:30 | Wrap up"
const LEADING = new RegExp(`^\\s*${BULLET}${TS}${SEP}(.+?)\\s*$`);
// "Intro - 00:00", "Setup (1:02:03)"
const TRAILING = new RegExp(`^\\s*${BULLET}(.+?)${SEP}${TS}\\s*$`);

/**
 * Extract chapters from free-form text such as a YouTube-style description:
 * one timestamp per line, either before or after the title. Returns an empty
 * list unless at least two distinct chapters are found, so an incidental
 * timestamp in a transcript or README doesn't become a lone "chapter".
 */
export function parseChapterText(text: string): Chapter[] {
  const byStart = new Map<number, string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.includes('-->')) continue; // skip VTT/SRT cue timings

    let start: number | null = null;
    let title = '';

    const lead = line.match(LEADING);
    if (lead) {
      start = parseTimestamp(lead[1]);
      title = lead[2];
    } else {
      const trail = line.match(TRAILING);
      if (trail) {
        start = parseTimestamp(trail[2]);
        title = trail[1];
      }
    }

    title = title.replace(/^[-–—:|.\s]+|[-–—:|\s]+$/g, '').trim();
    if (start === null || !title || byStart.has(start)) continue;
    byStart.set(start, title);
  }

  const chapters = [...byStart.entries()]
    .map(([start, title]) => ({ start, title }))
    .sort((a, b) => a.start - b.start);

  if (chapters.length < 2) return [];

  // Chapter tracks need to cover the start of the video.
  if (chapters[0].start > 0) chapters.unshift({ start: 0, title: 'Intro' });
  return chapters;
}

/**
 * Turn chapter start times into contiguous cues ending at the video duration.
 * Chapters starting at or beyond the end are dropped.
 */
export function chaptersToCues(chapters: Chapter[], duration: number): ChapterCue[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const valid = chapters.filter((c) => c.start < duration);
  return valid.map((chapter, i) => ({
    startTime: chapter.start,
    endTime: i + 1 < valid.length ? valid[i + 1].start : duration,
    text: chapter.title,
  }));
}
