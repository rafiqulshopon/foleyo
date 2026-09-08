'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dedupeSubtitles, getSubtitleLabel, loadSubtitle } from '@/app/lib/subtitles';
import type { Lesson } from '@/app/types';

export interface SubtitleTrack {
  src: string;
  language: string;
  label: string;
}

/**
 * Owns the video object URL and subtitle blob URLs for the active lesson.
 * Every load revokes the previous URLs before creating new ones
 * (revoke-before-create), and everything is revoked on unmount.
 */
export function useVideoLoader() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const currentUrlRef = useRef<string | null>(null);

  const revokeUrl = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    setSubtitleTracks((prev) => {
      prev.forEach((track) => URL.revokeObjectURL(track.src));
      return [];
    });
  }, []);

  // Revoke any remaining URLs when the provider unmounts
  useEffect(() => () => revokeUrl(), [revokeUrl]);

  /**
   * Revoke the previous URLs, load the lesson's video file and subtitles,
   * and return the new video object URL.
   */
  const loadVideo = useCallback(
    async (lesson: Lesson): Promise<string> => {
      revokeUrl();
      const file = await lesson.fileHandle.getFile();
      const url = URL.createObjectURL(file);
      currentUrlRef.current = url;

      if (lesson.subtitles && lesson.subtitles.length > 0) {
        try {
          // Deduplicate to handle courses cached before subtitle dedup existed
          const uniqueSubtitles = dedupeSubtitles(lesson.subtitles);

          const tracks = await Promise.all(
            uniqueSubtitles.map(async (sub) => {
              const src = await loadSubtitle(sub.fileHandle, sub.format);
              return {
                src,
                language: sub.language,
                label: getSubtitleLabel(sub.language),
              };
            })
          );
          setSubtitleTracks(tracks);
        } catch (e) {
          console.error('Failed to load subtitles', e);
          setSubtitleTracks([]);
        }
      } else {
        setSubtitleTracks([]);
      }

      return url;
    },
    [revokeUrl]
  );

  /** Drop all URLs and clear the video URL (course close). */
  const resetVideo = useCallback(() => {
    revokeUrl();
    setVideoUrl(null);
  }, [revokeUrl]);

  return {
    videoUrl,
    subtitleTracks,
    loadVideo,
    showVideo: setVideoUrl,
    resetVideo,
  };
}
