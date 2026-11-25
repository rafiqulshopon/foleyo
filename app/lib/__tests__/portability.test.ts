import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBackup,
  parseBackupJson,
  restoreBackup,
  summarizeBackup,
} from '@/app/lib/backup';
import {
  applyCourseSyncPayload,
  buildCourseSyncPayload,
} from '@/app/lib/folder-sync';
import { buildNotesExport } from '@/app/lib/notes-export';
import { createEmptyProgress, updateLessonProgress } from '@/app/lib/progress-store';
import type { Course } from '@/app/types';

beforeEach(() => {
  localStorage.clear();
});

describe('backup & restore', () => {
  it('exports only foleyo_* keys and summarizes contents accurately', () => {
    localStorage.setItem('foleyo_progress_react', JSON.stringify({ courseName: 'React', lessons: {} }));
    localStorage.setItem('foleyo_notes_React', JSON.stringify({ 'm1/a': 'Hello' }));
    localStorage.setItem('foleyo_bookmarks_React', JSON.stringify({ 'm1/a': [] }));
    localStorage.setItem('foleyo_watch_history', JSON.stringify({ days: { '2026-11-25': 1200 }, dailyGoalMinutes: 30 }));
    localStorage.setItem('unrelated_key', 'ignored');

    const backup = createBackup(new Date('2026-11-25T12:00:00.000Z'));
    expect(backup.app).toBe('foleyo');
    expect(backup.data['unrelated_key']).toBeUndefined();

    const summary = summarizeBackup(backup);
    expect(summary.coursesCount).toBe(1);
    expect(summary.notesCoursesCount).toBe(1);
    expect(summary.bookmarksCoursesCount).toBe(1);
    expect(summary.hasWatchHistory).toBe(true);
    expect(summary.totalKeys).toBe(4);
  });

  it('rejects invalid JSON or non-foleyo files', () => {
    expect(() => parseBackupJson('{bad')).toThrow('not valid JSON');
    expect(() => parseBackupJson(JSON.stringify({ app: 'other', data: {} }))).toThrow('not a Foleyo backup');
  });

  it('merges watch history days and preserves unrelated courses in merge mode, and wipes in replace mode', () => {
    localStorage.setItem('foleyo_progress_existing', JSON.stringify({ courseName: 'Existing' }));
    localStorage.setItem(
      'foleyo_watch_history',
      JSON.stringify({ days: { '2026-11-24': 600, '2026-11-25': 900 }, dailyGoalMinutes: 30 })
    );

    const incoming = parseBackupJson(
      JSON.stringify({
        app: 'foleyo',
        version: 1,
        exportedAt: '2026-11-25T12:00:00.000Z',
        data: {
          foleyo_progress_new: JSON.stringify({ courseName: 'New' }),
          foleyo_watch_history: JSON.stringify({
            days: { '2026-11-25': 1800, '2026-11-26': 300 },
            dailyGoalMinutes: 45,
          }),
        },
      })
    );

    restoreBackup(incoming, 'merge');
    expect(localStorage.getItem('foleyo_progress_existing')).not.toBeNull();
    expect(localStorage.getItem('foleyo_progress_new')).not.toBeNull();

    const mergedHistory = JSON.parse(localStorage.getItem('foleyo_watch_history')!);
    expect(mergedHistory.days).toEqual({
      '2026-11-24': 600,
      '2026-11-25': 1800,
      '2026-11-26': 300,
    });
    expect(mergedHistory.dailyGoalMinutes).toBe(45);

    restoreBackup(incoming, 'replace');
    expect(localStorage.getItem('foleyo_progress_existing')).toBeNull();
    expect(localStorage.getItem('foleyo_progress_new')).not.toBeNull();
  });
});

describe('folder sync (.foleyo.json)', () => {
  it('builds and merges a course sync payload by keeping newer lesson timestamps', () => {
    let localProg = createEmptyProgress('Rust');
    localProg = updateLessonProgress(localProg, 'm1/01.mp4', {
      completed: false,
      lastPosition: 50,
    });
    localProg.lessons['m1/01.mp4'].lastWatched = 1000;

    let incomingProg = createEmptyProgress('Rust');
    incomingProg = updateLessonProgress(incomingProg, 'm1/01.mp4', {
      completed: true,
      lastPosition: 0,
    });
    incomingProg.lessons['m1/01.mp4'].lastWatched = 2000;

    const payload = buildCourseSyncPayload('Rust', incomingProg);
    payload.notes = { 'm1/01.mp4': 'Ownership rules' };

    const merged = applyCourseSyncPayload('Rust', payload, localProg);
    expect(merged.lessons['m1/01.mp4'].completed).toBe(true);
    expect(JSON.parse(localStorage.getItem('foleyo_notes_Rust')!)).toEqual({
      'm1/01.mp4': 'Ownership rules',
    });
  });
});

describe('notes export options', () => {
  const course = {
    name: 'Web Dev',
    totalLessons: 2,
    modules: [
      {
        id: 'm1',
        title: 'HTML Basics',
        folderName: '01_HTML',
        index: 0,
        lessons: [
          { id: 'm1/01.mp4', title: 'Intro', fileName: '01.mp4', moduleId: 'm1', index: 0, localIndex: 0, fileHandle: {} as never },
        ],
      },
      {
        id: 'm2',
        title: 'CSS Layout',
        folderName: '02_CSS',
        index: 1,
        lessons: [
          { id: 'm2/01.mp4', title: 'Flexbox', fileName: '01.mp4', moduleId: 'm2', index: 1, localIndex: 0, fileHandle: {} as never },
        ],
      },
    ],
  } as unknown as Course;

  const notes = {
    'm1/01.mp4': 'Semantic tags matter.',
    'm2/01.mp4': 'Use gap instead of margin.',
  };
  const bookmarks = {
    'm1/01.mp4': [{ id: 'b1', time: 75, text: 'Header example', createdAt: 1 }],
  };

  it('exports Obsidian format with YAML frontmatter and callout timestamps', () => {
    const res = buildNotesExport(
      course,
      notes,
      bookmarks,
      {},
      { format: 'obsidian', scope: 'course', includeTimestamps: true },
      new Date('2026-11-25T00:00:00Z')
    );
    expect(res.hasContent).toBe(true);
    expect(res.fileName).toBe('web-dev-obsidian.md');
    expect(res.content).toContain('type: course-notes');
    expect(res.content).toContain('> [!quote] Timestamps');
    expect(res.content).toContain('`1:15` — Header example');
  });

  it('supports per-module scope and excluding timestamps in Notion format', () => {
    const res = buildNotesExport(
      course,
      notes,
      bookmarks,
      {},
      { format: 'notion', scope: 'module', moduleId: 'm1', includeTimestamps: false },
      new Date('2026-11-25T00:00:00Z')
    );
    expect(res.hasContent).toBe(true);
    expect(res.fileName).toBe('web-dev-html-basics-notion.md');
    expect(res.content).toContain('Semantic tags matter.');
    expect(res.content).not.toContain('Flexbox');
    expect(res.content).not.toContain('Header example');
  });
});
