import type { Course } from '@/app/types';
import type { CourseBookmarks } from '@/app/lib/bookmarks';
import { getDisplayTitle, type LessonOverrides } from '@/app/lib/lesson-overrides';
import { formatTimestamp } from '@/app/lib/time';

export type NotesExportFormat = 'markdown' | 'obsidian' | 'notion';
export type NotesExportScope = 'course' | 'module';

export interface NotesExportOptions {
  format: NotesExportFormat;
  scope: NotesExportScope;
  /** Required when scope === 'module'. */
  moduleId?: string;
  includeTimestamps: boolean;
}

function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Render course or module notes & bookmarks into Markdown tailored for
 * standard Markdown, Obsidian (YAML frontmatter + callouts), or Notion.
 */
export function buildNotesExport(
  course: Course,
  allNotes: Record<string, string>,
  courseBookmarks: CourseBookmarks,
  overrides: LessonOverrides,
  options: NotesExportOptions,
  now: Date = new Date(),
): { content: string; fileName: string; hasContent: boolean } {
  const targetModules =
    options.scope === 'module' && options.moduleId
      ? course.modules.filter((m) => m.id === options.moduleId)
      : course.modules;

  const dateIso = now.toISOString().slice(0, 10);
  const scopeTitle =
    options.scope === 'module' && targetModules[0]
      ? `${course.name} — ${targetModules[0].title}`
      : course.name;

  let body = '';
  let hasContent = false;

  for (const mod of targetModules) {
    let modHasContent = false;
    let modSection = `## ${mod.title}\n\n`;

    for (const lesson of mod.lessons) {
      const lessonNote = allNotes[lesson.id]?.trim() ?? '';
      const bookmarks = options.includeTimestamps
        ? (courseBookmarks[lesson.id] ?? [])
        : [];

      if (!lessonNote && bookmarks.length === 0) continue;

      modHasContent = true;
      hasContent = true;

      const title = getDisplayTitle(lesson, overrides);
      modSection += `### ${title}\n\n`;

      if (bookmarks.length > 0) {
        if (options.format === 'obsidian') {
          modSection += `> [!quote] Timestamps\n`;
          for (const b of bookmarks) {
            const ts = `\`${formatTimestamp(b.time)}\``;
            modSection += b.text.trim()
              ? `> - ${ts} — ${b.text.trim()}\n`
              : `> - ${ts}\n`;
          }
          modSection += '\n';
        } else if (options.format === 'notion') {
          for (const b of bookmarks) {
            const ts = `\`${formatTimestamp(b.time)}\``;
            modSection += b.text.trim()
              ? `- ⏱️ ${ts} **${b.text.trim()}**\n`
              : `- ⏱️ ${ts}\n`;
          }
          modSection += '\n';
        } else {
          for (const b of bookmarks) {
            const ts = `**${formatTimestamp(b.time)}**`;
            modSection += b.text.trim()
              ? `- ${ts} — ${b.text.trim()}\n`
              : `- ${ts}\n`;
          }
          modSection += '\n';
        }
      }

      if (lessonNote) {
        modSection += `${lessonNote}\n\n`;
      }
    }

    if (modHasContent) {
      body += modSection;
    }
  }

  let header = '';
  if (options.format === 'obsidian') {
    const tag = slugifyTag(course.name) || 'course';
    header = [
      '---',
      `title: "${scopeTitle.replace(/"/g, '\\"')}"`,
      'type: course-notes',
      `course: "${course.name.replace(/"/g, '\\"')}"`,
      `updated: ${dateIso}`,
      'tags:',
      '  - foleyo',
      `  - ${tag}`,
      '---',
      '',
      `# ${scopeTitle}`,
      '',
    ].join('\n');
  } else if (options.format === 'notion') {
    header = [
      `# ${scopeTitle}`,
      '',
      `> 📚 **Course:** ${course.name} · **Exported:** ${dateIso}`,
      '',
      '---',
      '',
    ].join('\n');
  } else {
    header = `# ${scopeTitle} — Notes\n\n`;
  }

  const slugBase = slugifyTag(scopeTitle) || 'course';
  const suffix =
    options.format === 'obsidian'
      ? '-obsidian'
      : options.format === 'notion'
        ? '-notion'
        : '-notes';

  return {
    content: header + body,
    fileName: `${slugBase}${suffix}.md`,
    hasContent,
  };
}
