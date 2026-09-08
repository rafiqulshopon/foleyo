import { describe, it, expect } from 'vitest';
import { getVideoMimeType, hasCodecRisk } from '@/app/types';

describe('getVideoMimeType', () => {
  it('maps extensions vidstack knows to their container MIME type', () => {
    expect(getVideoMimeType('a.mp4')).toBe('video/mp4');
    expect(getVideoMimeType('a.m4v')).toBe('video/mp4');
    expect(getVideoMimeType('a.webm')).toBe('video/webm');
    expect(getVideoMimeType('a.ogv')).toBe('video/ogg');
  });

  it('returns undefined for MKV/MOV and unknown names — the video provider sniffs blob content', () => {
    expect(getVideoMimeType('a.mkv')).toBeUndefined();
    expect(getVideoMimeType('a.mov')).toBeUndefined();
    expect(getVideoMimeType('A.WEBM')).toBe('video/webm');
    expect(getVideoMimeType('no-extension')).toBeUndefined();
  });
});

describe('hasCodecRisk', () => {
  it('flags MKV and MOV — containers that may hold codecs Chrome cannot decode', () => {
    expect(hasCodecRisk('lesson.mkv')).toBe(true);
    expect(hasCodecRisk('lesson.mov')).toBe(true);
    expect(hasCodecRisk('LESSON.MKV')).toBe(true);
  });

  it('does not flag MP4/WebM/Ogv', () => {
    expect(hasCodecRisk('lesson.mp4')).toBe(false);
    expect(hasCodecRisk('lesson.webm')).toBe(false);
    expect(hasCodecRisk('lesson.ogv')).toBe(false);
  });
});
