import { describe, it, expect } from 'vitest';
import {
  convertSrtToVtt,
  loadSubtitle,
  dedupeSubtitles,
  getSubtitleLabel,
  pickDefaultSubtitle,
  readCaptionPreference,
  saveCaptionPreference,
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
