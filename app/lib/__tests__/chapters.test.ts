import { describe, it, expect } from 'vitest';
import { formatTimestamp, parseTimestamp } from '@/app/lib/time';
import { parseChapterText, chaptersToCues } from '@/app/lib/chapters';

describe('formatTimestamp', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(9)).toBe('0:09');
    expect(formatTimestamp(125.9)).toBe('2:05');
  });

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatTimestamp(3600)).toBe('1:00:00');
    expect(formatTimestamp(3665)).toBe('1:01:05');
  });

  it('clamps negative or non-finite values to 0:00', () => {
    expect(formatTimestamp(-5)).toBe('0:00');
    expect(formatTimestamp(Number.NaN)).toBe('0:00');
  });
});

describe('parseTimestamp', () => {
  it('parses m:ss, mm:ss, h:mm:ss, and fractional seconds', () => {
    expect(parseTimestamp('0:00')).toBe(0);
    expect(parseTimestamp('1:05')).toBe(65);
    expect(parseTimestamp('01:02:03')).toBe(3723);
    expect(parseTimestamp('00:01:02.5')).toBe(62.5);
  });

  it('rejects invalid timestamps', () => {
    expect(parseTimestamp('not-a-time')).toBeNull();
    expect(parseTimestamp('1:75')).toBeNull();
    expect(parseTimestamp('1:65:00')).toBeNull();
  });
});

describe('parseChapterText', () => {
  it('parses YouTube-style leading timestamps', () => {
    const text = `
      00:00 Intro
      01:30 - Setup & Install
      - [05:15] Writing Code
      1:02:00 | Wrap up
    `;
    expect(parseChapterText(text)).toEqual([
      { start: 0, title: 'Intro' },
      { start: 90, title: 'Setup & Install' },
      { start: 315, title: 'Writing Code' },
      { start: 3720, title: 'Wrap up' },
    ]);
  });

  it('parses trailing timestamps and prepends Intro when first chapter > 0', () => {
    const text = `
      Setup (0:30)
      Demo - 2:00
    `;
    expect(parseChapterText(text)).toEqual([
      { start: 0, title: 'Intro' },
      { start: 30, title: 'Setup' },
      { start: 120, title: 'Demo' },
    ]);
  });

  it('ignores VTT cue lines and returns empty when fewer than two chapters exist', () => {
    expect(parseChapterText('00:00:01.000 --> 00:00:05.000\nHello')).toEqual([]);
    expect(parseChapterText('Only one 01:00 mention')).toEqual([]);
  });
});

describe('chaptersToCues', () => {
  it('builds contiguous cues up to duration and drops out-of-range chapters', () => {
    const cues = chaptersToCues(
      [
        { start: 0, title: 'Intro' },
        { start: 30, title: 'Main' },
        { start: 200, title: 'Past end' },
      ],
      120
    );
    expect(cues).toEqual([
      { startTime: 0, endTime: 30, text: 'Intro' },
      { startTime: 30, endTime: 120, text: 'Main' },
    ]);
  });

  it('returns empty for non-positive duration', () => {
    expect(chaptersToCues([{ start: 0, title: 'Intro' }], 0)).toEqual([]);
  });
});
