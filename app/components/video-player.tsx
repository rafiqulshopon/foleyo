"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type RefObject,
} from "react";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  useMediaRemote,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import {
  useCourse,
  AUTO_ADVANCE_DELAY_MS,
} from "@/app/context/course-context";
import { useLessonDurations } from "@/app/context/lesson-durations-context";
import { getLessonProgress } from "@/app/lib/progress-store";
import { useNotes, useCourseNotes } from "@/app/lib/use-notes";
import { FOCUS_RING } from "@/app/components/focus-ring";
import { MKV_WARNING, type Lesson } from "@/app/types";

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
    autoAdvance,
    cancelAutoAdvance,
  } = useCourse();
  const { setLessonDuration } = useLessonDurations();

  const playerRef = useRef<MediaPlayerInstance>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hasRestoredRef = useRef<string | null>(null);
  const wasFullscreenRef = useRef(false);
  // The URL that last reported canplay. Comparing it to the current videoUrl
  // derives readiness without a setState-in-effect reset when lessons change.
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const { note, updateNote, isSaved } = useNotes(
    course?.name,
    currentLesson?.id,
  );
  const courseNotes = useCourseNotes(course?.name);

  const isReady = videoUrl !== null && readyUrl === videoUrl;

  const hasAnyNotes = Object.keys(courseNotes).length > 0 || note.trim() !== "";

  const handleExportNotes = useCallback(() => {
    if (!course) return;

    const allNotes = { ...courseNotes };
    if (currentLesson && note.trim() !== "") {
      allNotes[currentLesson.id] = note;
    } else if (currentLesson && note.trim() === "") {
      delete allNotes[currentLesson.id];
    }

    if (Object.keys(allNotes).length === 0) return;

    let markdown = `# ${course.name} — Notes\n\n`;

    course.modules.forEach((module) => {
      let moduleHasNotes = false;
      let moduleMarkdown = `## ${module.title}\n\n`;

      module.lessons.forEach((lesson) => {
        const lessonNote = allNotes[lesson.id];
        if (lessonNote && lessonNote.trim() !== "") {
          moduleHasNotes = true;
          moduleMarkdown += `### ${lesson.title}\n${lessonNote.trim()}\n\n`;
        }
      });

      if (moduleHasNotes) {
        markdown += moduleMarkdown;
      }
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [course, courseNotes, currentLesson, note]);

  const [playbackRate, setPlaybackRate] = useState(() => {
    if (typeof window !== "undefined") {
      const savedSpeedStr = localStorage.getItem("foleyo_playback_speed");
      const savedSpeed = savedSpeedStr ? parseFloat(savedSpeedStr) : 1;
      return !isNaN(savedSpeed) ? savedSpeed : 1;
    }
    return 1;
  });

  // Initialize once from localStorage (loaded via dynamic ssr:false, so window exists).
  // Snapshot only — later changes are persisted by onTextTrackChange.
  const [ccInitial] = useState<boolean>(
    () => localStorage.getItem("foleyo_cc_enabled") !== "false",
  );

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

  // Reset the restore flag when the video URL changes (refs only — no state to reset)
  useEffect(() => {
    // Before resetting, check if we're currently in fullscreen
    if (document.fullscreenElement) {
      wasFullscreenRef.current = true;
    }
    hasRestoredRef.current = null;
  }, [videoUrl]);

  // Track fullscreen state changes from the browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      // If user manually exited fullscreen (e.g. pressed Esc), clear the flag
      if (!document.fullscreenElement) {
        wasFullscreenRef.current = false;
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const remote = useMediaRemote(playerRef);

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      updatePosition(detail.currentTime);
    },
    [updatePosition],
  );

  const handleCanPlay = useCallback(() => {
    setReadyUrl(videoUrl);
    // Explicitly set the remote playback rate as Vidstack doesn't automatically sync the prop
    if (remote) {
      remote.changePlaybackRate(playbackRate);
    }
    // Report video duration to the context for watch time stats
    if (currentLesson && playerRef.current) {
      const dur = playerRef.current.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setLessonDuration(currentLesson.id, dur);
      }
    }
    // Re-enter fullscreen if we were in fullscreen before the lesson changed
    if (wasFullscreenRef.current && playerContainerRef.current) {
      wasFullscreenRef.current = false;
      playerContainerRef.current.requestFullscreen?.().catch(() => {
        // Fullscreen request may fail if not triggered by user gesture
      });
    }
  }, [remote, playbackRate, currentLesson, setLessonDuration, videoUrl]);

  // Vidstack passes the new rate as the first argument (detail)
  const handleRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    localStorage.setItem("foleyo_playback_speed", rate.toString());
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

  // Pending auto-advance: the countdown targets a lesson that isn't current yet
  const pendingNext =
    autoAdvance && autoAdvance.lessonId !== currentLesson?.id
      ? (allLessons.find((l) => l.id === autoAdvance.lessonId) ?? null)
      : null;

  if (!currentLesson) {
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
      <div className="w-full max-w-240 px-4 py-6 animate-fade-in">
        {/* Lesson title */}
        <div className="mb-4">
          <p className="text-xs text-foreground-subtle mb-1 font-medium uppercase tracking-wider">
            {
              course?.modules.find((m) => m.id === currentLesson.moduleId)
                ?.title
            }
          </p>
          <h1 className="text-xl font-semibold text-foreground">
            {currentLesson.title}
          </h1>
        </div>

        {/* Video player */}
        <div
          ref={playerContainerRef}
          tabIndex={-1}
          className="rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-white/5 relative aspect-video focus:outline-none"
        >
          {requiresPermission ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Grant file access and resume video"
              className={`absolute inset-0 flex items-center justify-center bg-black/80 cursor-pointer group hover:bg-black/70 transition-colors ${FOCUS_RING}`}
              onClick={grantPermission}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  grantPermission();
                }
              }}
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-accent/90 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(var(--accent),0.3)]">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-2"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <p className="text-white/80 text-sm font-medium">
                  Click to resume video
                </p>
              </div>
            </div>
          ) : !videoUrl ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div
                className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">Loading video…</span>
            </div>
          ) : (
            <MediaPlayer
              ref={playerRef}
              src={{ src: videoUrl, type: "video/mp4" }}
              crossOrigin=""
              onTimeUpdate={handleTimeUpdate}
              onCanPlay={handleCanPlay}
              onEnded={handleEnded}
              onRateChange={handleRateChange}
              onTextTrackChange={(track) => {
                const isEnabled = track != null;
                localStorage.setItem("foleyo_cc_enabled", isEnabled.toString());
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
                    key={`${track.language}-${track.label}`}
                    src={track.src}
                    kind="subtitles"
                    label={track.label}
                    lang={track.language}
                    default={
                      ccInitial &&
                      (track.language === "en" || subtitleTracks.length === 1)
                    }
                  />
                ))}
              </MediaProvider>
              <DefaultVideoLayout icons={defaultLayoutIcons} />
            </MediaPlayer>
          )}

          {/* Auto-advance countdown overlay */}
          {pendingNext && autoAdvance && (
            <AutoAdvanceOverlay
              next={pendingNext}
              endsAt={autoAdvance.endsAt}
              onCancel={cancelAutoAdvance}
              containerRef={playerContainerRef}
            />
          )}
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={prevLesson}
            disabled={!hasPrev}
            aria-label="Previous lesson"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${FOCUS_RING} ${
              hasPrev
                ? "bg-surface hover:bg-surface-hover border border-border text-foreground hover:border-foreground-subtle"
                : "bg-surface/50 border border-border/50 text-foreground-subtle cursor-not-allowed"
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
            aria-label="Next lesson"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${FOCUS_RING} ${
              hasNext
                ? "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20"
                : "bg-surface/50 border border-border/50 text-foreground-subtle cursor-not-allowed"
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
        {currentLesson.fileName.toLowerCase().endsWith(".mkv") && (
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
            <span>{MKV_WARNING}</span>
          </div>
        )}

        {/* Inline Notes Section */}
        <div className="mt-8 bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-hover/50">
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground-subtle"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h3 className="font-medium text-foreground">Lesson Notes</h3>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`text-xs font-medium flex items-center gap-1 transition-opacity duration-300 ${isSaved ? "opacity-100 text-success" : "opacity-0"}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </span>

              <button
                onClick={handleExportNotes}
                disabled={!hasAnyNotes}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasAnyNotes
                    ? "bg-accent/10 text-accent hover:bg-accent hover:text-white"
                    : "bg-surface text-foreground-muted cursor-not-allowed"
                }`}
                title={
                  hasAnyNotes
                    ? "Export all notes for this course as Markdown"
                    : "No notes yet"
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export .md
              </button>
            </div>
          </div>
          <div className="p-1">
            <textarea
              value={note}
              onChange={(e) => updateNote(e.target.value)}
              aria-label="Lesson notes"
              placeholder="Write your notes here... (Auto-saves as you type)"
              className="w-full min-h-40 p-4 bg-transparent border-none text-sm leading-relaxed text-foreground focus:outline-none focus:ring-0 resize-y placeholder:text-foreground-muted/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Countdown overlay shown after a video ends when autoplay is on. It mounts
 * once per countdown (seconds state starts fresh), and the tick interval
 * re-derives from `endsAt` so a backgrounded tab stays truthful. The shrink
 * animation is pure CSS, so prefers-reduced-motion disables it cleanly.
 */
function AutoAdvanceOverlay({
  next,
  endsAt,
  onCancel,
  containerRef,
}: {
  next: Lesson;
  endsAt: number;
  onCancel: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(AUTO_ADVANCE_DELAY_MS / 1000),
  );
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel while the countdown is up; return focus to the player
  // when it resolves or is cancelled.
  useEffect(() => {
    cancelRef.current?.focus();
    const playerContainer = containerRef.current;
    return () => playerContainer?.focus();
  }, [containerRef]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-label={`Up next: ${next.title}. Press Escape or Cancel to stay on this lesson.`}
    >
      <div className="flex flex-col items-center gap-2.5 max-w-md px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50">
          Up next
        </p>
        <p className="text-sm font-medium text-white line-clamp-2">
          {next.title}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <span className="font-mono text-xs text-white/60" aria-hidden="true">
            in {secondsLeft}s
          </span>
        </div>
        {/* Shrink duration is set inline to stay in sync with the constant */}
        <div
          className="h-0.5 w-48 overflow-hidden rounded-full bg-white/15 mt-2"
          aria-hidden="true"
        >
          <div
            className="h-full origin-left bg-accent auto-advance-bar"
            style={{ animationDuration: `${AUTO_ADVANCE_DELAY_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
