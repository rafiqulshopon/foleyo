import { describe, it, expect } from 'vitest';
import { parseCourseDirectory } from '@/app/lib/parse-course';
import { FakeDirHandle } from './helpers/fake-fs';

describe('parseCourseDirectory', () => {
  it('derives the course name from the root folder name', async () => {
    const root = new FakeDirHandle('My Awesome Course');
    root.addFile('01_Intro.mp4');

    const course = await parseCourseDirectory(root);
    expect(course.name).toBe('My Awesome Course');
  });

  it('puts root-level videos in a "Course Content" module with id "root"', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('01_Welcome.mp4');

    const course = await parseCourseDirectory(root);
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].id).toBe('root');
    expect(course.modules[0].title).toBe('Course Content');
    expect(course.totalLessons).toBe(1);
  });

  it('strips numeric prefixes and tidies lesson titles', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('01_Intro.mp4');
    root.addFile('1. Welcome.mp4');
    root.addFile('03 - Setup.mp4');
    root.addFile('02.Advanced_topic.mp4');
    root.addFile('no-prefix.mp4');

    const course = await parseCourseDirectory(root);
    const titles = course.modules[0].lessons.map((l) => l.title);
    // Un-prefixed names sort first (no leading digits → 0), then by number
    expect(titles).toEqual(['No Prefix', 'Intro', 'Welcome', 'Advanced Topic', 'Setup']);
  });

  it('naturally sorts lessons by numeric prefix (2 before 10)', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('10_Tenth.mp4');
    root.addFile('2_Second.mp4');
    root.addFile('1_First.mp4');

    const course = await parseCourseDirectory(root);
    const titles = course.modules[0].lessons.map((l) => l.title);
    expect(titles).toEqual(['First', 'Second', 'Tenth']);
  });

  it('creates modules from subfolders and joins nested paths with " - "', async () => {
    const root = new FakeDirHandle('Course');
    const partA = root.addDir('01_Part A');
    partA.addFile('01_Lesson.mp4');
    const deep = partA.addDir('02_Deep');
    deep.addFile('01_Nested.mp4');

    const course = await parseCourseDirectory(root);
    const ids = course.modules.map((m) => m.id);
    const titles = course.modules.map((m) => m.title);

    expect(ids).toContain('01_Part A');
    expect(ids).toContain('01_Part A/02_Deep');
    expect(titles).toContain('Part A');
    expect(titles).toContain('Part A - Deep');
    // Folder order: root (no videos) excluded, Part A before Part A/Deep
    expect(course.modules[0].id).toBe('01_Part A');
  });

  it('sorts sibling modules naturally too', async () => {
    const root = new FakeDirHandle('Course');
    root.addDir('10_Sections').addFile('a.mp4');
    root.addDir('2_Basics').addFile('b.mp4');

    const course = await parseCourseDirectory(root);
    expect(course.modules.map((m) => m.title)).toEqual(['Basics', 'Sections']);
  });

  it('ignores hidden folders', async () => {
    const root = new FakeDirHandle('Course');
    root.addDir('.git').addFile('hook.mp4');
    root.addFile('01_Real.mp4');

    const course = await parseCourseDirectory(root);
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].id).toBe('root');
  });

  it('builds lesson ids as moduleId/fileName and tracks indexes', async () => {
    const root = new FakeDirHandle('Course');
    const mod = root.addDir('01_Mod');
    mod.addFile('01_A.mp4');
    mod.addFile('02_B.mp4');

    const course = await parseCourseDirectory(root);
    const lessons = course.modules[0].lessons;
    expect(lessons[0].id).toBe('01_Mod/01_A.mp4');
    expect(lessons[0].index).toBe(0);
    expect(lessons[0].localIndex).toBe(0);
    expect(lessons[1].index).toBe(1);
    expect(lessons[1].localIndex).toBe(1);
    expect(lessons[0].moduleId).toBe('01_Mod');
  });

  it('matches sibling subtitle files by lesson base name and detects language', async () => {
    const root = new FakeDirHandle('Course');
    const mod = root.addDir('01_Mod');
    mod.addFile('01_Intro.mp4');
    mod.addFile('01_Intro.en.srt');
    mod.addFile('01_Intro.es.vtt');
    mod.addFile('02_Other.en.srt'); // belongs to another lesson
    mod.addFile('01_Intro.srt'); // no language tag

    const course = await parseCourseDirectory(root);
    const lesson = course.modules[0].lessons[0];
    const langs = lesson.subtitles?.map((s) => s.language).sort();
    expect(langs).toEqual(['Unknown', 'en', 'es']);
  });

  it('prefers VTT over SRT for the same language', async () => {
    const root = new FakeDirHandle('Course');
    const mod = root.addDir('01_Mod');
    mod.addFile('01_Intro.mp4');
    mod.addFile('01_Intro.en.srt');
    mod.addFile('01_Intro.en.vtt');

    const course = await parseCourseDirectory(root);
    const subs = course.modules[0].lessons[0].subtitles;
    expect(subs).toHaveLength(1);
    expect(subs![0].format).toBe('vtt');
  });

  it('sets subtitles to undefined when none match', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('01_Intro.mp4');
    root.addFile('02_Unrelated.en.srt');

    const course = await parseCourseDirectory(root);
    expect(course.modules[0].lessons[0].subtitles).toBeUndefined();
  });

  it('returns an empty course for a folder with no videos', async () => {
    const root = new FakeDirHandle('Empty');
    root.addFile('readme.txt');
    root.addDir('Sub').addFile('notes.srt');

    const course = await parseCourseDirectory(root);
    expect(course.modules).toHaveLength(0);
    expect(course.totalLessons).toBe(0);
  });

  it('accepts every browser-playable extension (mp4, m4v, webm, ogv, mkv, mov)', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('01_A.mp4');
    root.addFile('02_B.m4v');
    root.addFile('03_C.webm');
    root.addFile('04_D.ogv');
    root.addFile('05_E.mkv');
    root.addFile('06_F.mov');

    const course = await parseCourseDirectory(root);
    expect(course.totalLessons).toBe(6);
  });

  it('ignores MPEG-TS files — browsers cannot demux them (and .ts collides with TypeScript sources)', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('stream-recording.ts');
    root.addFile('01_Real.mp4');

    const course = await parseCourseDirectory(root);
    expect(course.totalLessons).toBe(1);
    expect(course.modules[0].lessons[0].fileName).toBe('01_Real.mp4');
  });

  it('matches video files case-insensitively', async () => {
    const root = new FakeDirHandle('Course');
    root.addFile('01_Course.MP4');
    root.addFile('02_Lesson.WebM');

    const course = await parseCourseDirectory(root);
    expect(course.totalLessons).toBe(2);
  });
});
