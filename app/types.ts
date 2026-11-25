// Core data types for the course player

import type { VideoMimeType } from '@vidstack/react';

export interface SubtitleInfo {
  language: string; // e.g. 'en', 'es', or 'Unknown'
  format: 'srt' | 'vtt';
  fileHandle: FileSystemFileHandle;
}

/**
 * A per-lesson chapter source: a WebVTT chapters file (`lesson.chapters.vtt`)
 * or a text/description file with timestamps (`lesson.txt`, `lesson.description`).
 */
export interface ChapterSource {
  format: 'vtt' | 'text';
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
  chapters?: ChapterSource;
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

// Supported video extensions — only containers Chromium's <video> element can
// demux (https://www.chromium.org/audio-video/). MPEG-TS (.ts) is not one of
// them; it only plays via HLS, where hls.js demuxes in JS.
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.m4v',
  '.webm',
  '.ogv',
  '.mkv',
  '.mov',
] as const;

export const SUBTITLE_EXTENSIONS = ['.srt', '.vtt'] as const;

/** Text files that may carry chapter timestamps for the matching video. */
export const CHAPTER_TEXT_EXTENSIONS = ['.chapters.txt', '.txt', '.description', '.md'] as const;

const VIDEO_MIME_TYPES: Record<string, VideoMimeType> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
};

/**
 * MIME hint for the MediaPlayer src — advisory only, the browser sniffs the
 * blob content regardless. Returns undefined for containers vidstack's type
 * union doesn't know (MKV, MOV): vidstack then falls back to its video
 * provider, which handles them natively.
 */
export function getVideoMimeType(fileName: string): VideoMimeType | undefined {
  const dot = fileName.lastIndexOf('.');
  const ext = dot === -1 ? '' : fileName.slice(dot).toLowerCase();
  return VIDEO_MIME_TYPES[ext];
}

// Containers that play in Chrome but commonly carry codecs it can't decode
// (HEVC is hardware-only, Dolby Digital/AC-3 and ProRes are never decoded).
const CODEC_RISK_EXTENSIONS = ['.mkv', '.mov'] as const;

export function hasCodecRisk(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return CODEC_RISK_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const CODEC_WARNING =
  "MKV and MOV files depend on the codecs inside. H.264/AAC plays in Chrome; H.265/HEVC (hardware-only), Dolby Digital (AC-3), and ProRes won't. Convert to MP4 (H.264) for guaranteed playback.";

export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];
