import { describe, it, expect } from 'vitest';
import { buildVirtualDirectoryFromFiles } from '@/app/lib/webkit-directory';
import { parseCourseDirectory } from '@/app/lib/parse-course';
import { computeThumbnailTimestamps } from '@/app/lib/seek-thumbnails';
import { buildCodecHelp } from '@/app/lib/codec-help';

function makeFileWithPath(relPath: string, content = ''): File {
  const parts = relPath.split('/');
  const name = parts[parts.length - 1];
  const file = new File([content], name);
  Object.defineProperty(file, 'webkitRelativePath', {
    value: relPath,
    configurable: true,
  });
  return file;
}

describe('buildVirtualDirectoryFromFiles (Firefox/Safari fallback)', () => {
  it('wraps a webkitdirectory File array into a FileSystemDirectoryHandle tree parsed by parseCourseDirectory', async () => {
    const files = [
      makeFileWithPath('My_Course/01_Setup/01_Install.mp4', 'video'),
      makeFileWithPath('My_Course/01_Setup/01_Install.en.srt', '1\n00:00:01,000 --> 00:00:02,000\nHi'),
      makeFileWithPath('My_Course/02_Core/01_Basics.mp4', 'video'),
      makeFileWithPath('My_Course/02_Core/cheatsheet.pdf', 'pdf'),
    ];

    const root = buildVirtualDirectoryFromFiles(files);
    expect(root).not.toBeNull();
    expect(root!.name).toBe('My_Course');

    const course = await parseCourseDirectory(root!);
    expect(course.name).toBe('My Course');
    expect(course.modules).toHaveLength(2);
    expect(course.totalLessons).toBe(2);
    expect(course.modules[0].lessons[0].subtitles).toHaveLength(1);
    expect(course.modules[1].resources).toHaveLength(1);
  });

  it('returns null for an empty file list', () => {
    expect(buildVirtualDirectoryFromFiles([])).toBeNull();
  });
});

describe('computeThumbnailTimestamps', () => {
  it('returns empty for very short or invalid durations', () => {
    expect(computeThumbnailTimestamps(0)).toEqual([]);
    expect(computeThumbnailTimestamps(2)).toEqual([]);
    expect(computeThumbnailTimestamps(Number.NaN)).toEqual([]);
  });

  it('clamps frame count between 4 and 36 evenly across the video', () => {
    expect(computeThumbnailTimestamps(20)).toHaveLength(4);
    expect(computeThumbnailTimestamps(120)).toHaveLength(12);
    expect(computeThumbnailTimestamps(3600)).toHaveLength(36);
  });
});

describe('buildCodecHelp', () => {
  it('generates container-aware explanation and escaped ffmpeg commands for MKV/MOV', () => {
    const info = buildCodecHelp('01_Intro "HEVC".mkv');
    expect(info.headline).toContain('MKV');
    expect(info.explanation).toContain('H.265/HEVC');
    expect(info.remuxCommand).toContain('ffmpeg -i "01_Intro \\"HEVC\\".mkv"');
    expect(info.remuxCommand).toContain('-c:v copy -c:a aac');
    expect(info.transcodeCommand).toContain('-c:v libx264');
    expect(info.transcodeCommand).toContain('"01_Intro \\"HEVC\\".mp4"');
  });
});
