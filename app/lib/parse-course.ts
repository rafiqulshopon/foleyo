import {
  Course,
  CourseResource,
  Module,
  Lesson,
  VIDEO_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
  CHAPTER_TEXT_EXTENSIONS,
  SubtitleInfo,
  ChapterSource,
  isHtmlFile,
  classifyResourceFile,
} from '@/app/types';
import { dedupeSubtitles } from '@/app/lib/subtitles';

/** Directories that should never be scanned as course modules. */
const IGNORED_DIRECTORY_NAMES = new Set([
  'node_modules',
  '__pycache__',
  '.git',
  '.svn',
  '.hg',
  '.next',
  '.venv',
  'venv',
  'dist',
  'build',
  'target',
  'vendor',
  '.idea',
  '.vscode',
]);

/** Files whose presence signals that a folder is a code project, not a course module. */
const CODE_PROJECT_MARKERS = new Set([
  'package.json',
  'tsconfig.json',
  'cargo.toml',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'gemfile',
  'makefile',
  'cmakelists.txt',
  'composer.json',
  'pubspec.yaml',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
]);

/** Extensions indicating web/code source files alongside index.html in a code folder. */
const CODE_SOURCE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.rs',
  '.go',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.cs',
];

/** Extensions that are internal metadata / subtitle / chapter-only files, not user resources. */
const INTERNAL_FILE_EXTENSIONS = ['.srt', '.vtt', '.chapters.txt', '.description'];

/**
 * Clean a filename into a human-readable title.
 * Strips numeric prefixes (01_, 02_, etc.), file extensions,
 * and replaces underscores/hyphens with spaces.
 */
export function cleanTitle(filename: string, stripExtension: boolean = false): string {
  let name = filename;

  if (stripExtension) {
    const lastDot = name.lastIndexOf('.');
    if (lastDot > 0) {
      name = name.substring(0, lastDot);
    }
  }

  // Strip leading numeric prefix like "01_", "02-", "1. ", "01 - "
  name = name.replace(/^\d+[\s._-]+/, '');

  // Replace underscores and hyphens with spaces
  name = name.replace(/[_-]/g, ' ');

  // Clean up multiple spaces
  name = name.replace(/\s+/g, ' ').trim();

  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, (c) => c.toUpperCase());

  return name || filename;
}

/**
 * Check if a filename is a supported video file.
 */
function isVideoFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isInternalFile(filename: string): boolean {
  if (filename.startsWith('.')) return true;
  const lower = filename.toLowerCase();
  if (lower === 'thumbs.db' || lower === 'desktop.ini') return true;
  return INTERNAL_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getFileExtension(filename: string): string | undefined {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return undefined;
  return filename.slice(dot).toLowerCase();
}

/**
 * Sort entries by their filename, respecting numeric prefixes.
 * "01_foo" comes before "02_bar", "10_baz" comes after "2_qux".
 */
function sortByName(a: string, b: string): number {
  const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
  const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);

  if (numA !== numB) return numA - numB;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

interface FileEntry {
  name: string;
  handle: FileSystemFileHandle;
}

interface DirEntry {
  name: string;
  handle: FileSystemDirectoryHandle;
}

interface ScannedFolder {
  path: string[];
  handle: FileSystemDirectoryHandle;
  videoFiles: FileEntry[];
  htmlFiles: FileEntry[];
  subtitleFiles: FileEntry[];
  textFiles: FileEntry[];
  resourceFiles: FileEntry[];
  resourceDirs: DirEntry[];
}

function isChapterTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return CHAPTER_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Find a chapter source for a video: `<base>.chapters.vtt` wins, then the
 * first of `<base>.chapters.txt`, `<base>.txt`, `<base>.description`, `<base>.md`.
 */
function findChapterSource(
  baseName: string,
  subtitleFiles: FileEntry[],
  textFiles: FileEntry[]
): ChapterSource | undefined {
  const lowerBase = baseName.toLowerCase();
  const vtt = subtitleFiles.find(
    (f) => f.name.toLowerCase() === `${lowerBase}.chapters.vtt`
  );
  if (vtt) return { format: 'vtt', fileHandle: vtt.handle };

  for (const ext of CHAPTER_TEXT_EXTENSIONS) {
    const match = textFiles.find((f) => f.name.toLowerCase() === lowerBase + ext);
    if (match) return { format: 'text', fileHandle: match.handle };
  }
  return undefined;
}

function isCodeProjectDirectory(files: FileEntry[]): boolean {
  for (const f of files) {
    if (CODE_PROJECT_MARKERS.has(f.name.toLowerCase())) {
      return true;
    }
  }
  const hasIndexHtml = files.some((f) => f.name.toLowerCase() === 'index.html');
  const hasCodeSource = files.some((f) => {
    const lower = f.name.toLowerCase();
    return CODE_SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  });
  return hasIndexHtml && hasCodeSource;
}

interface ScanResult {
  folders: ScannedFolder[];
  /** True if this directory or any descendant contained at least one lesson. */
  hasLessons: boolean;
  /** True if this directory has any non-ignored files or subdirectories. */
  hasContent: boolean;
  /** Root-level resources when root itself has no lessons. */
  rootResourceFiles: FileEntry[];
  rootResourceDirs: DirEntry[];
}

async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  currentPath: string[] = []
): Promise<ScanResult> {
  const folders: ScannedFolder[] = [];
  const videoFiles: FileEntry[] = [];
  const htmlFiles: FileEntry[] = [];
  const subtitleFiles: FileEntry[] = [];
  const textFiles: FileEntry[] = [];
  const allFiles: FileEntry[] = [];
  const resourceFiles: FileEntry[] = [];
  const subDirs: DirEntry[] = [];
  const resourceDirs: DirEntry[] = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (entry.name.startsWith('.')) continue;
      const lower = entry.name.toLowerCase();
      allFiles.push({ name: entry.name, handle: entry });

      if (isVideoFile(entry.name)) {
        videoFiles.push({ name: entry.name, handle: entry });
      } else if (isHtmlFile(entry.name)) {
        htmlFiles.push({ name: entry.name, handle: entry });
      } else if (SUBTITLE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        subtitleFiles.push({ name: entry.name, handle: entry });
      } else {
        if (isChapterTextFile(entry.name)) {
          textFiles.push({ name: entry.name, handle: entry });
        }
        if (!isInternalFile(entry.name)) {
          resourceFiles.push({ name: entry.name, handle: entry });
        }
      }
    } else if (entry.kind === 'directory') {
      if (
        !entry.name.startsWith('.') &&
        !IGNORED_DIRECTORY_NAMES.has(entry.name.toLowerCase())
      ) {
        subDirs.push({ name: entry.name, handle: entry });
      }
    }
  }

  // If this is a nested code project (no videos, has package.json / index.html+js etc.),
  // treat the entire folder as a code folder resource rather than parsing its HTML as lessons.
  const isRoot = currentPath.length === 0;
  if (!isRoot && videoFiles.length === 0 && isCodeProjectDirectory(allFiles)) {
    return {
      folders: [],
      hasLessons: false,
      hasContent: true,
      rootResourceFiles: [],
      rootResourceDirs: [],
    };
  }

  let childHasLessons = false;
  for (const subDir of subDirs) {
    const subResult = await scanDirectory(subDir.handle, [
      ...currentPath,
      subDir.name,
    ]);
    if (subResult.hasLessons) {
      childHasLessons = true;
      folders.push(...subResult.folders);
    } else if (subResult.hasContent) {
      // Subfolder has no lessons, only code/resources — attach as a folder resource
      resourceDirs.push(subDir);
    }
  }

  const ownLessons = videoFiles.length > 0 || htmlFiles.length > 0;
  if (ownLessons) {
    folders.push({
      path: currentPath,
      handle: dirHandle,
      videoFiles,
      htmlFiles,
      subtitleFiles,
      textFiles,
      resourceFiles,
      resourceDirs,
    });
  }

  const hasContent =
    resourceFiles.length > 0 ||
    resourceDirs.length > 0 ||
    allFiles.length > 0 ||
    subDirs.length > 0;

  return {
    folders,
    hasLessons: ownLessons || childHasLessons,
    hasContent,
    rootResourceFiles: isRoot && !ownLessons ? resourceFiles : [],
    rootResourceDirs: isRoot && !ownLessons ? resourceDirs : [],
  };
}

function buildResources(
  moduleId: string,
  resourceFiles: FileEntry[],
  resourceDirs: DirEntry[]
): CourseResource[] {
  const resources: CourseResource[] = [];

  for (const file of resourceFiles) {
    resources.push({
      id: `${moduleId}/res:${file.name}`,
      name: file.name,
      title: cleanTitle(file.name, true),
      kind: classifyResourceFile(file.name),
      moduleId,
      extension: getFileExtension(file.name),
      fileHandle: file.handle,
    });
  }

  for (const dir of resourceDirs) {
    resources.push({
      id: `${moduleId}/dir:${dir.name}`,
      name: dir.name,
      title: cleanTitle(dir.name, false),
      kind: 'folder',
      moduleId,
      dirHandle: dir.handle,
    });
  }

  resources.sort((a, b) => sortByName(a.name, b.name));
  return resources;
}

/**
 * Parse a directory handle into a Course structure recursively.
 * Sub-folders become modules, video & HTML files inside = lessons,
 * and non-video files / code folders become module resources.
 */
export async function parseCourseDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<Course> {
  const modules: Module[] = [];

  const scanResult = await scanDirectory(dirHandle);
  const allFolders = scanResult.folders;

  // Sort folders by path length, then by each path component
  allFolders.sort((a, b) => {
    if (a.path.length === 0 && b.path.length > 0) return -1;
    if (a.path.length > 0 && b.path.length === 0) return 1;

    const minLen = Math.min(a.path.length, b.path.length);
    for (let i = 0; i < minLen; i++) {
      const cmp = sortByName(a.path[i], b.path[i]);
      if (cmp !== 0) return cmp;
    }
    return a.path.length - b.path.length;
  });

  let globalIndex = 0;

  for (let i = 0; i < allFolders.length; i++) {
    const folder = allFolders[i];
    const {
      path,
      videoFiles,
      htmlFiles,
      subtitleFiles,
      textFiles,
      resourceFiles,
      resourceDirs,
    } = folder;
    const isRoot = path.length === 0;

    const moduleId = isRoot ? 'root' : path.join('/');
    const moduleTitle = isRoot
      ? 'Course Content'
      : path.map((p) => cleanTitle(p)).join(' - ');
    const folderName = isRoot ? '' : path[path.length - 1];

    // Combine video and HTML lessons and sort naturally by filename
    const combinedLessons: Array<FileEntry & { kind: 'video' | 'html' }> = [
      ...videoFiles.map((v) => ({ ...v, kind: 'video' as const })),
      ...htmlFiles.map((h) => ({ ...h, kind: 'html' as const })),
    ];
    combinedLessons.sort((a, b) => sortByName(a.name, b.name));

    const lessons: Lesson[] = [];

    for (let j = 0; j < combinedLessons.length; j++) {
      const item = combinedLessons[j];

      if (item.kind === 'html') {
        lessons.push({
          id: `${moduleId}/${item.name}`,
          title: cleanTitle(item.name, true),
          fileName: item.name,
          fileHandle: item.handle,
          moduleId,
          index: globalIndex++,
          localIndex: j,
          kind: 'html',
        });
        continue;
      }

      const baseName = item.name.substring(0, item.name.lastIndexOf('.'));

      const rawSubtitles = subtitleFiles
        .filter((sub) => sub.name.startsWith(baseName + '.'))
        .map((sub) => {
          const lower = sub.name.toLowerCase();
          const format: 'vtt' | 'srt' = lower.endsWith('.vtt') ? 'vtt' : 'srt';
          let language = 'Unknown';
          const parts = sub.name
            .substring(baseName.length + 1, sub.name.lastIndexOf('.'))
            .split('.');
          if (parts.length > 0 && parts[0]) {
            language = parts[0];
          }
          return { language, format, fileHandle: sub.handle };
        })
        .filter((sub) => sub.language.toLowerCase() !== 'chapters');

      const subtitles: SubtitleInfo[] = dedupeSubtitles(rawSubtitles);
      const chapters = findChapterSource(baseName, subtitleFiles, textFiles);

      lessons.push({
        id: `${moduleId}/${item.name}`,
        title: cleanTitle(item.name, true),
        fileName: item.name,
        fileHandle: item.handle,
        moduleId,
        index: globalIndex++,
        localIndex: j,
        kind: 'video',
        subtitles: subtitles.length > 0 ? subtitles : undefined,
        ...(chapters ? { chapters } : {}),
      });
    }

    const resources = buildResources(moduleId, resourceFiles, resourceDirs);

    modules.push({
      id: moduleId,
      title: moduleTitle,
      folderName,
      lessons,
      ...(resources.length > 0 ? { resources } : {}),
      index: i,
    });
  }

  const rootResources =
    modules.length > 0
      ? buildResources(
          'root',
          scanResult.rootResourceFiles,
          scanResult.rootResourceDirs
        )
      : [];

  return {
    name: cleanTitle(dirHandle.name),
    modules,
    totalLessons: globalIndex,
    ...(rootResources.length > 0 ? { resources: rootResources } : {}),
  };
}
