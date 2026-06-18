import { Course, Module, Lesson, VIDEO_EXTENSIONS } from '@/app/types';

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

/**
 * Parse a directory handle into a Course structure.
 * Top-level subfolders = modules, video files inside = lessons.
 * Also handles flat structure (videos directly in root = single module).
 */
export async function parseCourseDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<Course> {
  const modules: Module[] = [];
  const rootVideos: { name: string; handle: FileSystemFileHandle }[] = [];
  const subfolders: { name: string; handle: FileSystemDirectoryHandle }[] = [];

  // First pass: collect subfolders and root-level video files
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory') {
      subfolders.push({ name: entry.name, handle: entry });
    } else if (entry.kind === 'file' && isVideoFile(entry.name)) {
      rootVideos.push({ name: entry.name, handle: entry });
    }
  }

  // Sort subfolders
  subfolders.sort((a, b) => sortByName(a.name, b.name));

  let globalIndex = 0;

  // Process subfolders as modules
  for (let i = 0; i < subfolders.length; i++) {
    const folder = subfolders[i];
    const lessons: Lesson[] = [];
    const videoFiles: { name: string; handle: FileSystemFileHandle }[] = [];

    for await (const entry of folder.handle.values()) {
      if (entry.kind === 'file' && isVideoFile(entry.name)) {
        videoFiles.push({ name: entry.name, handle: entry });
      }
    }

    // Sort video files
    videoFiles.sort((a, b) => sortByName(a.name, b.name));

    for (let j = 0; j < videoFiles.length; j++) {
      const video = videoFiles[j];
      lessons.push({
        id: `${folder.name}/${video.name}`,
        title: cleanTitle(video.name, true),
        fileName: video.name,
        fileHandle: video.handle,
        moduleId: folder.name,
        index: globalIndex++,
        localIndex: j,
      });
    }

    if (lessons.length > 0) {
      modules.push({
        id: folder.name,
        title: cleanTitle(folder.name),
        folderName: folder.name,
        lessons,
        index: i,
      });
    }
  }

  // If there are root-level videos, create a single "Lessons" module
  if (rootVideos.length > 0) {
    rootVideos.sort((a, b) => sortByName(a.name, b.name));
    const lessons: Lesson[] = rootVideos.map((video, j) => ({
      id: `root/${video.name}`,
      title: cleanTitle(video.name, true),
      fileName: video.name,
      fileHandle: video.handle,
      moduleId: 'root',
      index: globalIndex++,
      localIndex: j,
    }));

    modules.push({
      id: 'root',
      title: 'Lessons',
      folderName: '',
      lessons,
      index: modules.length,
    });
  }

  return {
    name: cleanTitle(dirHandle.name),
    modules,
    totalLessons: globalIndex,
  };
}
