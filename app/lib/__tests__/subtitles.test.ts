import { describe, it, expect } from 'vitest';
import {
  convertSrtToVtt,
  loadSubtitle,
  dedupeSubtitles,
  getSubtitleLabel,
  pickDefaultSubtitle,
  readCaptionPreference,
  saveCaptionPreference,
  parseVttCues,
  findActiveCueIndex,
  searchSubtitleCues,
} from '@/app/lib/subtitles';
import type { SubtitleInfo } from '@/app/types';
import { FakeFileHandle } from './helpers/fake-fs';

describe('convertSrtToVtt', () => {
  it('prepends the WEBVTT header', () => {
    expect(convertSrtToVtt('')).toMatch(/^WEBVTT\n\n/);
  });

  it('converts commas to dots only on timestamp lines', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      'Hello, world',
      '',
      '2',
      '00:00:05,500 --> 00:00:06,000',
      'Second, line',
    ].join('\n');

    const vtt = convertSrtToVtt(srt);
    expect(vtt).toContain('00:00:01.000 --> 00:00:04.000');
    expect(vtt).toContain('00:00:05.500 --> 00:00:06.000');
    expect(vtt).toContain('Hello, world');
    expect(vtt).toContain('Second, line');
    expect(vtt).not.toContain('00:00:01,000');
  });
});

describe('loadSubtitle', () => {
  it('returns an object URL for an SRT file', async () => {
    const handle = new FakeFileHandle(
      '01_Intro.en.srt',
      new File(['1\n00:00:01,000 --> 00:00:02,000\nHi'], '01_Intro.en.srt')
    );
    const url = await loadSubtitle(handle, 'srt');
    expect(url).toMatch(/^blob:/);
  });

  it('returns an object URL for a VTT file without conversion', async () => {
    const handle = new FakeFileHandle(
      '01_Intro.en.vtt',
      new File(['WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi'], '01_Intro.en.vtt')
    );
    const url = await loadSubtitle(handle, 'vtt');
    expect(url).toMatch(/^blob:/);
  });
});

describe('dedupeSubtitles', () => {
  it('prefers VTT over SRT for the same language', () => {
    const srt = { language: 'en', format: 'srt' } as SubtitleInfo;
    const vtt = { language: 'en', format: 'vtt' } as SubtitleInfo;
    expect(dedupeSubtitles([srt, vtt])).toEqual([vtt]);
    expect(dedupeSubtitles([vtt, srt])).toEqual([vtt]);
  });

  it('keeps distinct languages', () => {
    const en = { language: 'en', format: 'vtt' } as SubtitleInfo;
    const es = { language: 'es', format: 'srt' } as SubtitleInfo;
    expect(dedupeSubtitles([en, es])).toHaveLength(2);
  });

  it('keeps the only track for a language even if SRT', () => {
    const srt = { language: 'fr', format: 'srt' } as SubtitleInfo;
    expect(dedupeSubtitles([srt])).toEqual([srt]);
  });
});

describe('getSubtitleLabel', () => {
  it('maps known codes to friendly labels', () => {
    expect(getSubtitleLabel('en')).toBe('English');
    expect(getSubtitleLabel('ja')).toBe('Japanese');
  });

  it('uppercases unknown codes', () => {
    expect(getSubtitleLabel('xx')).toBe('XX');
  });

  it('labels the Unknown sentinel as Default', () => {
    expect(getSubtitleLabel('Unknown')).toBe('Default');
  });
});

describe('caption language preference', () => {
  it('remembers the last chosen language even after toggling captions off and back on', () => {
    localStorage.clear();
    saveCaptionPreference('es');
    expect(readCaptionPreference()).toEqual({ enabled: true, language: 'es' });

    saveCaptionPreference(null);
    expect(readCaptionPreference()).toEqual({ enabled: false, language: 'es' });
  });

  it('picks the preferred language, falling back to en or the sole track', () => {
    const tracks = [{ language: 'en' }, { language: 'es' }];
    expect(pickDefaultSubtitle(tracks, { enabled: true, language: 'es' })).toBe('es');
    expect(pickDefaultSubtitle(tracks, { enabled: true, language: 'fr' })).toBe('en');
    expect(pickDefaultSubtitle(tracks, { enabled: false, language: 'es' })).toBeNull();
    expect(pickDefaultSubtitle([{ language: 'ja' }], { enabled: true, language: null })).toBe('ja');
  });
});

describe('parseVttCues, findActiveCueIndex & searchSubtitleCues', () => {
  const sampleVtt = [
    'WEBVTT',
    '',
    'NOTE this is a comment',
    '',
    '1',
    '00:00:01.000 --> 00:00:04.500 align:start',
    '<i>Welcome</i> to &amp; React',
    '',
    '00:00:06.000 --> 00:00:09.000',
    'Today we build a',
    'custom hook',
  ].join('\n');

  it('parses cues, strips VTT/HTML tags, decodes entities, and skips NOTE blocks', () => {
    const cues = parseVttCues(sampleVtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({
      startTime: 1,
      endTime: 4.5,
      text: 'Welcome to & React',
    });
    expect(cues[1]).toMatchObject({
      startTime: 6,
      endTime: 9,
      text: 'Today we build a custom hook',
    });
  });

  it('finds the active cue index for a timestamp and returns -1 in gaps', () => {
    const cues = parseVttCues(sampleVtt);
    expect(findActiveCueIndex(cues, 0.2)).toBe(-1);
    expect(findActiveCueIndex(cues, 2.5)).toBe(0);
    expect(findActiveCueIndex(cues, 5.2)).toBe(-1);
    expect(findActiveCueIndex(cues, 7.0)).toBe(1);
    expect(findActiveCueIndex(cues, 15.0)).toBe(-1);
  });

  it('searches cues case-insensitively across multiple terms', () => {
    const cues = parseVttCues(sampleVtt);
    expect(searchSubtitleCues(cues, 'react welcome')).toHaveLength(1);
    expect(searchSubtitleCues(cues, 'CUSTOM HOOK')).toHaveLength(1);
    expect(searchSubtitleCues(cues, 'missing term')).toHaveLength(0);
    expect(searchSubtitleCues(cues, '   ')).toHaveLength(2);
  });
});
