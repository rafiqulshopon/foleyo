// Core data types for the course player

export interface SubtitleInfo {
  language: string; // e.g. 'en', 'es', or 'Unknown'
  format: 'srt' | 'vtt';
  fileHandle: FileSystemFileHandle;
}

export interface Lesson {
  id: string;
  title: string;
  fileName: string;
  fileHandle: FileSystemFileHandle;
  moduleId: string;
  index: number; // global index across all modules
  localIndex: number; // index within the module
  subtitles?: SubtitleInfo[];
}

export interface Module {
  id: string;
  title: string;
  folderName: string;
  lessons: Lesson[];
  index: number;
}

export interface Course {
  name: string;
  modules: Module[];
  totalLessons: number;
}

// Progress tracking types
export interface LessonProgress {
  completed: boolean;
  lastPosition: number; // seconds
  lastWatched: number; // timestamp
}

export interface CourseProgress {
  courseName: string;
  lastLessonId: string;
  lessons: Record<string, LessonProgress>;
  lastOpened: number; // timestamp
}

// Supported video extensions
export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov', '.ts'] as const;

// MKV warning codecs
export const MKV_WARNING =
  'MKV files may not play in Chrome if they use unsupported codecs (e.g., H.265/HEVC). Consider converting to MP4 (H.264) for best compatibility.';

export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];
