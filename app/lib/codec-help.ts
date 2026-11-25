import { hasCodecRisk } from '@/app/types';

export interface CodecHelpInfo {
  headline: string;
  explanation: string;
  remuxCommand: string;
  transcodeCommand: string;
}

/**
 * Escape a filename safely for double-quoted shell arguments.
 */
function escapeShellArg(name: string): string {
  return name.replace(/(["\\$`])/g, '\\$1');
}

function outputMp4Name(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.mp4`;
}

/**
 * Build a clear explanation and ready-to-copy `ffmpeg` commands for a video
 * file that failed to play or uses a codec-risk container (MKV / MOV).
 */
export function buildCodecHelp(fileName: string): CodecHelpInfo {
  const safeIn = escapeShellArg(fileName);
  const safeOut = escapeShellArg(outputMp4Name(fileName));
  const ext = fileName.split('.').pop()?.toUpperCase() || 'VIDEO';
  const risky = hasCodecRisk(fileName);

  const headline = risky
    ? `Your browser couldn't decode this ${ext} file`
    : `This video couldn't be played in the browser`;

  const explanation = risky
    ? `${ext} is a container format — browsers can play it only when the streams inside use H.264 video and AAC audio. Files encoded with H.265/HEVC, Dolby Digital (AC-3/DTS), or Apple ProRes fail to decode in Chrome, Firefox, and Safari.`
    : `The video or audio codec inside "${fileName}" isn't supported by your browser's built-in decoder (common with HEVC/H.265, AC-3, or DTS tracks). Converting it to MP4 (H.264 + AAC) fixes playback everywhere.`;

  return {
    headline,
    explanation,
    remuxCommand: `ffmpeg -i "${safeIn}" -c:v copy -c:a aac -movflags +faststart "${safeOut}"`,
    transcodeCommand: `ffmpeg -i "${safeIn}" -c:v libx264 -crf 20 -preset medium -c:a aac -movflags +faststart "${safeOut}"`,
  };
}
