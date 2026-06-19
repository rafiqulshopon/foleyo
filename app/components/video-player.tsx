'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MediaPlayer, MediaProvider, Track, useMediaRemote, type MediaPlayerInstance } from '@vidstack/react';
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useCourse } from '@/app/context/course-context';
import { getLessonProgress } from '@/app/lib/progress-store';
import { useNotes } from '@/app/lib/use-notes';

export function VideoPlayer() {
  const {
    currentLesson,
    videoUrl,
    progress,
    updatePosition,
    onVideoEnded,
    nextLesson,
    prevLesson,
    course,
    subtitleTracks,
    requiresPermission,
    grantPermission,
  } = useCourse();

  const playerRef = useRef<MediaPlayerInstance>(null);
  const hasRestoredRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { note, updateNote, isSaved } = useNotes(course?.name, currentLesson?.id);

  const [playbackRate, setPlaybackRate] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedSpeedStr = localStorage.getItem('foleyo_playback_speed');
      const savedSpeed = savedSpeedStr ? parseFloat(savedSpeedStr) : 1;
      return !isNaN(savedSpeed) ? savedSpeed : 1;
    }
    return 1;
  });

  const ccEnabledRef = useRef<boolean>(true);
  
  // Initialize from localStorage only once on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      ccEnabledRef.current = localStorage.getItem('foleyo_cc_enabled') !== 'false';
    }
  });

  // Restore position when lesson changes
  useEffect(() => {
    if (!currentLesson || !isReady || !playerRef.current) return;
    if (hasRestoredRef.current === currentLesson.id) return;

    const lessonProgress = getLessonProgress(progress, currentLesson.id);
    if (lessonProgress.lastPosition > 2) {
      playerRef.current.currentTime = lessonProgress.lastPosition;
    }
    hasRestoredRef.current = currentLesson.id;
  }, [currentLesson, isReady, progress]);

  // Reset restored flag when lesson changes
  useEffect(() => {
    setIsReady(false);
    hasRestoredRef.current = null;
  }, [videoUrl]);

  const remote = useMediaRemote(playerRef);

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      updatePosition(detail.currentTime);
    },
    [updatePosition]
  );

  const handleCanPlay = useCallback(() => {
    setIsReady(true);
    // Explicitly set the remote playback rate as Vidstack doesn't automatically sync the prop
    if (remote) {
      remote.changePlaybackRate(playbackRate);
    }
  }, [remote, playbackRate]);

  // Vidstack passes the new rate as the first argument (detail)
  const handleRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    localStorage.setItem('foleyo_playback_speed', rate.toString());
  }, []);

  const handleEnded = useCallback(() => {
    onVideoEnded();
  }, [onVideoEnded]);

  // Determine if prev/next are available
  const allLessons = course?.modules.flatMap((m) => m.lessons) || [];
  const currentIdx = currentLesson
    ? allLessons.findIndex((l) => l.id === currentLesson.id)
    : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allLessons.length - 1;

  if (!videoUrl || !currentLesson) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-foreground-subtle text-sm">
          Select a lesson to start watching
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-[960px] px-4 py-6 animate-fade-in">
        {/* Lesson title */}
        <div className="mb-4">
          <p className="text-xs text-foreground-subtle mb-1 font-medium uppercase tracking-wider">
            {course?.modules.find((m) => m.id === currentLesson.moduleId)?.title}
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            {currentLesson.title}
          </h1>
        </div>

        {/* Video player */}
        <div className="rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-white/5 relative aspect-video">
          {requiresPermission ? (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/80 cursor-pointer group hover:bg-black/70 transition-colors"
              onClick={grantPermission}
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-accent/90 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(var(--accent),0.3)]">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <p className="text-white/80 text-sm font-medium">Click to resume video</p>
              </div>
            </div>
          ) : !videoUrl ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/60 text-sm">Loading video...</p>
              </div>
            </div>
          ) : (
            <MediaPlayer
              ref={playerRef}
              src={{ src: videoUrl, type: 'video/mp4' }}
              crossOrigin=""
              onTimeUpdate={handleTimeUpdate}
              onCanPlay={handleCanPlay}
              onEnded={handleEnded}
              onRateChange={handleRateChange}
              onTextTrackChange={(track) => {
                const isEnabled = track != null;
                ccEnabledRef.current = isEnabled;
                localStorage.setItem('foleyo_cc_enabled', isEnabled.toString());
              }}
              playbackRate={playbackRate}
              autoPlay
              className="w-full h-full"
              keyTarget="player"
              load="eager"
            >
              <MediaProvider>
                {subtitleTracks.map((track) => (
                  <Track
                    key={track.src}
                    src={track.src}
                    kind="subtitles"
                    label={track.label}
                    lang={track.language}
                    default={ccEnabledRef.current && (track.language === 'en' || subtitleTracks.length === 1)}
                  />
                ))}
              </MediaProvider>
              <DefaultVideoLayout
                icons={defaultLayoutIcons}
              />
            </MediaPlayer>
          )}
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={prevLesson}
            disabled={!hasPrev}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              hasPrev
                ? 'bg-surface hover:bg-surface-hover border border-border text-foreground hover:border-foreground-subtle'
                : 'bg-surface/50 border border-border/50 text-foreground-subtle cursor-not-allowed'
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center justify-center flex-1">
            {/* Lesson position indicator */}
            <span className="text-xs text-foreground-subtle font-mono">
              {currentIdx + 1} / {allLessons.length}
            </span>
          </div>

          <button
            onClick={nextLesson}
            disabled={!hasNext}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              hasNext
                ? 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
                : 'bg-surface/50 border border-border/50 text-foreground-subtle cursor-not-allowed'
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>


        {/* MKV warning */}
        {currentLesson.fileName.toLowerCase().endsWith('.mkv') && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-start gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              This is an MKV file. It may not play if it uses unsupported codecs
              like H.265/HEVC. If the video doesn&apos;t load, consider converting to
              MP4 (H.264).
            </span>
          </div>
        )}

        {/* Inline Notes Section */}
        <div className="mt-8 bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-hover/50">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-subtle">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h3 className="font-medium text-foreground">Lesson Notes</h3>
            </div>
            <span className={`text-xs font-medium flex items-center gap-1 transition-opacity duration-300 ${isSaved ? 'opacity-100 text-success' : 'opacity-0'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          </div>
          <div className="p-1">
            <textarea
              value={note}
              onChange={(e) => updateNote(e.target.value)}
              placeholder="Write your notes here... (Auto-saves as you type)"
              className="w-full min-h-[160px] p-4 bg-transparent border-none text-sm leading-relaxed text-foreground focus:outline-none focus:ring-0 resize-y placeholder:text-foreground-muted/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
