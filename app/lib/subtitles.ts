import type { SubtitleInfo } from '@/app/types';

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
 * Reads a subtitle file, converts to VTT if necessary, and returns an Object URL.
 */
export async function loadSubtitle(
  handle: FileSystemFileHandle,
  format: 'srt' | 'vtt'
): Promise<string> {
  const file = await handle.getFile();
  let text = await file.text();
  
  if (format === 'srt') {
    text = convertSrtToVtt(text);
  }
  
  const blob = new Blob([text], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}
