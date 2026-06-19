import { Course, Module, Lesson, VIDEO_EXTENSIONS, SubtitleInfo } from '@/app/types';

/**
 * Clean a filename into a human-readable title.
 * Strips numeric prefixes (01_, 02_, etc.), file extensions,
 * and replaces underscores/hyphens with spaces.
 */
function cleanTitle(filename: string, stripExtension: boolean = false): string {
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

/**
 * Sort entries by their filename, respecting numeric prefixes.
 * "01_foo" comes before "02_bar", "10_baz" comes after "2_qux".
 */
function sortByName(a: string, b: string): number {
  // Extract leading numbers for natural sort
  const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
  const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);

  if (numA !== numB) return numA - numB;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

interface ScannedFolder {
  path: string[];
  handle: FileSystemDirectoryHandle;
  videoFiles: { name: string; handle: FileSystemFileHandle }[];
  subtitleFiles: { name: string; handle: FileSystemFileHandle }[];
}

async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  currentPath: string[] = []
): Promise<ScannedFolder[]> {
  const folders: ScannedFolder[] = [];
  const videoFiles: { name: string; handle: FileSystemFileHandle }[] = [];
  const subtitleFiles: { name: string; handle: FileSystemFileHandle }[] = [];
  const subDirs: { name: string; handle: FileSystemDirectoryHandle }[] = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const lower = entry.name.toLowerCase();
      if (isVideoFile(entry.name)) {
        videoFiles.push({ name: entry.name, handle: entry });
      } else if (lower.endsWith('.srt') || lower.endsWith('.vtt')) {
        subtitleFiles.push({ name: entry.name, handle: entry });
      }
    } else if (entry.kind === 'directory') {
      // Ignore hidden folders like .git or .DS_Store
      if (!entry.name.startsWith('.')) {
        subDirs.push({ name: entry.name, handle: entry });
      }
    }
  }

  if (videoFiles.length > 0) {
    folders.push({
      path: currentPath,
      handle: dirHandle,
      videoFiles,
      subtitleFiles,
    });
  }

  for (const subDir of subDirs) {
    const subFolders = await scanDirectory(subDir.handle, [...currentPath, subDir.name]);
    folders.push(...subFolders);
  }

  return folders;
}

/**
 * Parse a directory handle into a Course structure recursively.
 * Sub-folders become modules, video files inside = lessons.
 */
export async function parseCourseDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<Course> {
  const modules: Module[] = [];
  
  const allFolders = await scanDirectory(dirHandle);
  
  // Sort folders by path length, then by each path component
  allFolders.sort((a, b) => {
    // Root level videos come first
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
    const { path, videoFiles, subtitleFiles } = folder;
    const isRoot = path.length === 0;
    
    // Create module ID and Title
    const moduleId = isRoot ? 'root' : path.join('/');
    // e.g. ["Module 1", "Sub 2"] -> "Module 1 - Sub 2"
    const moduleTitle = isRoot ? 'Course Content' : path.map(p => cleanTitle(p)).join(' - ');
    const folderName = isRoot ? '' : path[path.length - 1];

    // Sort video files inside this folder
    videoFiles.sort((a, b) => sortByName(a.name, b.name));
    
    const lessons: Lesson[] = [];

    for (let j = 0; j < videoFiles.length; j++) {
      const video = videoFiles[j];
      const baseName = video.name.substring(0, video.name.lastIndexOf('.'));
      
      const rawSubtitles = subtitleFiles
        .filter((sub) => sub.name.startsWith(baseName + '.'))
        .map((sub) => {
          const lower = sub.name.toLowerCase();
          const format: 'vtt' | 'srt' = lower.endsWith('.vtt') ? 'vtt' : 'srt';
          let language = 'Unknown';
          const parts = sub.name.substring(baseName.length + 1, sub.name.lastIndexOf('.')).split('.');
          if (parts.length > 0 && parts[0]) {
            language = parts[0];
          }
          return { language, format, fileHandle: sub.handle };
        });

      // Deduplicate by language, preferring VTT over SRT
      const subtitlesMap = new Map<string, typeof rawSubtitles[0]>();
      rawSubtitles.forEach(sub => {
        const existing = subtitlesMap.get(sub.language);
        if (!existing || sub.format === 'vtt') {
          subtitlesMap.set(sub.language, sub);
        }
      });
      const subtitles: SubtitleInfo[] = Array.from(subtitlesMap.values());

      lessons.push({
        id: `${moduleId}/${video.name}`,
        title: cleanTitle(video.name, true),
        fileName: video.name,
        fileHandle: video.handle,
        moduleId,
        index: globalIndex++,
        localIndex: j,
        subtitles: subtitles.length > 0 ? subtitles : undefined,
      });
    }

    modules.push({
      id: moduleId,
      title: moduleTitle,
      folderName,
      lessons,
      index: i,
    });
  }

  return {
    name: cleanTitle(dirHandle.name),
    modules,
    totalLessons: globalIndex,
  };
}
