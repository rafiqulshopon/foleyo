'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLessonKind, type Course } from '@/app/types';

/**
 * Background scan: extract duration metadata from every video in the course,
 * in small cancellable batches. Durations are kept in a ref (for the
 * skip-check and dedup) and mirrored to state for rendering.
 *
 * The scanner keeps its own blob-URL list, separate from the active video's
 * URL — those URLs are revoked when the course changes or the provider
 * unmounts.
 */
export function useDurationScanner(course: Course | null) {
  const [lessonDurations, setLessonDurations] = useState<
    Record<string, number>
  >({});
  const durationsRef = useRef<Record<string, number>>({});

  const setLessonDuration = useCallback(
    (lessonId: string, duration: number) => {
      if (!duration || !isFinite(duration) || duration <= 0) return;
      const rounded = Math.round(duration);
      // Only update if the value changed to avoid unnecessary re-renders
      if (durationsRef.current[lessonId] === rounded) return;
      durationsRef.current = { ...durationsRef.current, [lessonId]: rounded };
      setLessonDurations(durationsRef.current);
    },
    []
  );

  useEffect(() => {
    if (!course) return;

    let cancelled = false;
    const blobUrls: string[] = [];

    async function scanDurations() {
      const allLessons = course!.modules
        .flatMap((m) => m.lessons)
        .filter((l) => getLessonKind(l) === 'video');

      // Process in small batches to avoid overwhelming the browser
      const BATCH_SIZE = 3;
      for (let i = 0; i < allLessons.length; i += BATCH_SIZE) {
        if (cancelled) break;

        const batch = allLessons.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (lesson) => {
            if (cancelled) return;

            // Skip if we already know this lesson's duration
            if (durationsRef.current[lesson.id]) return;

            try {
              const file = await lesson.fileHandle.getFile();
              const url = URL.createObjectURL(file);
              blobUrls.push(url);

              const duration = await new Promise<number>((resolve, reject) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.muted = true;

                const cleanup = () => {
                  video.removeAttribute('src');
                  video.load(); // release resources
                };

                video.onerror = () => {
                  cleanup();
                  reject(new Error('Failed to load metadata'));
                };

                // Timeout after 10s per video
                const timer = setTimeout(() => {
                  cleanup();
                  reject(new Error('Metadata timeout'));
                }, 10000);

                video.onloadedmetadata = () => {
                  clearTimeout(timer);
                  const dur = video.duration;
                  cleanup();
                  if (dur && isFinite(dur) && dur > 0) {
                    resolve(dur);
                  } else {
                    reject(new Error('Invalid duration'));
                  }
                };

                video.src = url;
              });

              if (!cancelled) {
                setLessonDuration(lesson.id, duration);
              }
            } catch {
              // Silently skip videos that fail metadata extraction
            }
          })
        );
      }
    }

    scanDurations();

    return () => {
      cancelled = true;
      // Clean up any remaining blob URLs; durations belong to this course only
      blobUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
      durationsRef.current = {};
    };
  }, [course, setLessonDuration]);

  return { lessonDurations, setLessonDuration };
}
