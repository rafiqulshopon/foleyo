import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLessonOverrides,
  renameLesson,
  setLessonHidden,
  unhideAllLessons,
  getDisplayTitle,
  isLessonHidden,
  getVisibleLessons,
  countHiddenLessons,
} from '@/app/lib/lesson-overrides';
import type { Course } from '@/app/types';

const sampleCourse = {
  name: 'Test Course',
  totalLessons: 3,
  modules: [
    {
      id: 'm1',
      title: 'Module 1',
      folderName: '01_Module',
      index: 0,
      lessons: [
        { id: 'm1/01.mp4', title: 'Raw One', fileName: '01.mp4', moduleId: 'm1', index: 0, localIndex: 0, fileHandle: {} as never },
        { id: 'm1/02.mp4', title: 'Raw Two', fileName: '02.mp4', moduleId: 'm1', index: 1, localIndex: 1, fileHandle: {} as never },
        { id: 'm1/03.mp4', title: 'Raw Three', fileName: '03.mp4', moduleId: 'm1', index: 2, localIndex: 2, fileHandle: {} as never },
      ],
    },
  ],
} as unknown as Course;

beforeEach(() => {
  localStorage.clear();
});

describe('lesson-overrides', () => {
  it('renames lessons without mutating original lesson data and reverts on empty title', () => {
    renameLesson('Test Course', 'm1/01.mp4', '  Clean Intro  ');
    let overrides = readLessonOverrides('Test Course');
    expect(getDisplayTitle(sampleCourse.modules[0].lessons[0], overrides)).toBe('Clean Intro');
    expect(getDisplayTitle(sampleCourse.modules[0].lessons[1], overrides)).toBe('Raw Two');

    renameLesson('Test Course', 'm1/01.mp4', '   ');
    overrides = readLessonOverrides('Test Course');
    expect(getDisplayTitle(sampleCourse.modules[0].lessons[0], overrides)).toBe('Raw One');
    expect(localStorage.getItem('foleyo_lesson_overrides_Test Course')).toBeNull();
  });

  it('hides, counts, filters, and unhides lessons', () => {
    setLessonHidden('Test Course', 'm1/02.mp4', true);
    let overrides = readLessonOverrides('Test Course');

    expect(isLessonHidden('m1/02.mp4', overrides)).toBe(true);
    expect(isLessonHidden('m1/01.mp4', overrides)).toBe(false);
    expect(countHiddenLessons(sampleCourse, overrides)).toBe(1);
    expect(getVisibleLessons(sampleCourse, overrides).map((l) => l.id)).toEqual([
      'm1/01.mp4',
      'm1/03.mp4',
    ]);

    unhideAllLessons('Test Course');
    overrides = readLessonOverrides('Test Course');
    expect(countHiddenLessons(sampleCourse, overrides)).toBe(0);
    expect(getVisibleLessons(sampleCourse, overrides)).toHaveLength(3);
  });
});
