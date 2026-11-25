"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useState,
  type RefObject,
} from "react";
import {
  MediaPlayer,
  MediaProvider,
  Tooltip,
  Track,
  useMediaRemote,
  type MediaKeyShortcuts,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { useCourse, AUTO_ADVANCE_DELAY_MS } from "@/app/context/course-context";
import { useLessonDurations } from "@/app/context/lesson-durations-context";
import {
  computeModuleWatchTimeStats,
  getLessonProgress,
} from "@/app/lib/progress-store";
import { recordWatchSeconds } from "@/app/lib/watch-history";
import {
  getDisplayTitle,
  getVisibleLessons,
  useLessonOverrides,
} from "@/app/lib/lesson-overrides";
import { useNotes, useCourseNotes } from "@/app/lib/use-notes";
import {
  addBookmark,
  useCourseBookmarks,
  type Bookmark,
} from "@/app/lib/bookmarks";
import {
  useCourseSettings,
  updateCourseSettings,
  sanitizeSkipSeconds,
} from "@/app/lib/course-settings";
import {
  GLOBAL_SPEED_KEY,
  clampPlaybackRate,
  playbackRateOptions,
  readGlobalPlaybackRate,
  stepPlaybackRate,
} from "@/app/lib/playback-speed";
import {
  pickDefaultSubtitle,
  readCaptionPreference,
  saveCaptionPreference,
} from "@/app/lib/subtitles";
import { chaptersToCues } from "@/app/lib/chapters";
import { formatDuration } from "@/app/lib/time";
import {
  buildNotesExport,
  type NotesExportFormat,
  type NotesExportScope,
} from "@/app/lib/notes-export";
import {
  generateSeekThumbnailStoryboard,
  type ThumbnailStoryboard,
} from "@/app/lib/seek-thumbnails";
import { buildCodecHelp } from "@/app/lib/codec-help";
import {
  BookmarksPanel,
  type BookmarkFocusRequest,
} from "@/app/components/bookmarks-panel";
import {
  PlaybackToolbar,
  type LoopRange,
} from "@/app/components/playback-toolbar";
import { TranscriptPanel } from "@/app/components/transcript-panel";
import { FOCUS_RING } from "@/app/components/focus-ring";
import {
  CODEC_WARNING,
  getVideoMimeType,
  hasCodecRisk,
  type Lesson,
} from "@/app/types";

const EMPTY_LOOP: LoopRange = { a: null, b: null };

export function VideoPlayer() {
  const {
    currentLesson,
    videoUrl,
    progress,
    markComplete,
    updatePosition,
    onVideoEnded,
    nextLesson,
    prevLesson,
    selectLesson,
    course,
    subtitleTracks,
    chapters,
    requiresPermission,
    grantPermission,
    autoAdvance,
    cancelAutoAdvance,
    pendingSeek,
    clearPendingSeek,
    transcriptOpen,
    toggleTranscript,
    windowFullscreen,
    toggleWindowFullscreen,
    exitWindowFullscreen,
  } = useCourse();
  const { lessonDurations, setLessonDuration } = useLessonDurations();

  const playerRef = useRef<MediaPlayerInstance>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hasRestoredRef = useRef<string | null>(null);
  const wasFullscreenRef = useRef(false);
  const outroTriggeredRef = useRef(false);
  const resumeAfterBookmarkRef = useRef(false);
  const lastWatchTickRef = useRef<{ url: string; time: number } | null>(null);
  const accumulatedWatchRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  // The URL that last reported canplay. Comparing it to the current videoUrl
  // derives readiness without a setState-in-effect reset when lessons change.
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [durationState, setDurationState] = useState<{
    url: string | null;
    duration: number;
  }>({ url: null, duration: 0 });
  const [loopState, setLoopState] = useState<{
    url: string | null;
    range: LoopRange;
  }>({ url: null, range: EMPTY_LOOP });
  const [activeBookmarkState, setActiveBookmarkState] = useState<{
    url: string | null;
    id: string | null;
  }>({ url: null, id: null });
  const [bookmarkFocus, setBookmarkFocus] =
    useState<BookmarkFocusRequest | null>(null);
  const [mediaErrorUrl, setMediaErrorUrl] = useState<string | null>(null);
  const [showCodecFix, setShowCodecFix] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [seekThumbState, setSeekThumbState] = useState<{
    url: string;
    storyboard: ThumbnailStoryboard;
  } | null>(null);

  // Notes export options state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportScope, setExportScope] = useState<NotesExportScope>("course");
  const [exportFormat, setExportFormat] =
    useState<NotesExportFormat>("markdown");
  const [exportTimestamps, setExportTimestamps] = useState(true);
  const [copiedNotes, setCopiedNotes] = useState(false);

  const { note, updateNote, isSaved } = useNotes(
    course?.name,
    currentLesson?.id,
  );
  const courseNotes = useCourseNotes(course?.name);
  const courseBookmarks = useCourseBookmarks(course?.name);
  const courseSettings = useCourseSettings(course?.name);
  const lessonOverrides = useLessonOverrides(course?.name);

  const isReady = videoUrl !== null && readyUrl === videoUrl;
  const videoDuration =
    videoUrl !== null && durationState.url === videoUrl
      ? durationState.duration
      : 0;
  const loop: LoopRange =
    videoUrl !== null && loopState.url === videoUrl
      ? loopState.range
      : EMPTY_LOOP;
  const activeBookmarkId =
    videoUrl !== null && activeBookmarkState.url === videoUrl
      ? activeBookmarkState.id
      : null;

  const lessonBookmarks: Bookmark[] = useMemo(
    () => (currentLesson ? (courseBookmarks[currentLesson.id] ?? []) : []),
    [courseBookmarks, currentLesson],
  );

  const introSkip = courseSettings.introSkip ?? 0;
  const outroSkip = courseSettings.outroSkip ?? 0;

  const hasAnyNotes =
    Object.keys(courseNotes).length > 0 ||
    Object.keys(courseBookmarks).length > 0 ||
    note.trim() !== "";

  const hasMediaError = videoUrl !== null && mediaErrorUrl === videoUrl;
  const seekThumbnails =
    videoUrl !== null && seekThumbState?.url === videoUrl
      ? seekThumbState.storyboard
      : undefined;

  // Generate seek-bar thumbnail sprite sheet in the background once duration is known
  useEffect(() => {
    if (!videoUrl || videoDuration < 4 || hasMediaError) return;

    const controller = new AbortController();
    let createdUrl: string | null = null;

    generateSeekThumbnailStoryboard(
      videoUrl,
      videoDuration,
      controller.signal,
    ).then((storyboard) => {
      if (controller.signal.aborted) {
        if (storyboard) URL.revokeObjectURL(storyboard.url);
        return;
      }
      if (storyboard) {
        createdUrl = storyboard.url;
        setSeekThumbState({ url: videoUrl, storyboard });
      }
    });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [videoUrl, videoDuration, hasMediaError]);

  const copyCommand = useCallback((cmd: string) => {
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd((prev) => (prev === cmd ? null : prev)), 2000);
    }).catch(() => {});
  }, []);

  const buildCurrentNotesExport = useCallback(() => {
    if (!course) return null;

    const allNotes = { ...courseNotes };
    if (currentLesson && note.trim() !== "") {
      allNotes[currentLesson.id] = note;
    } else if (currentLesson && note.trim() === "") {
      delete allNotes[currentLesson.id];
    }

    return buildNotesExport(
      course,
      allNotes,
      courseBookmarks,
      lessonOverrides,
      {
        format: exportFormat,
        scope: exportScope,
        moduleId: currentLesson?.moduleId,
        includeTimestamps: exportTimestamps,
      },
    );
  }, [
    course,
    courseNotes,
    courseBookmarks,
    currentLesson,
    note,
    lessonOverrides,
    exportFormat,
    exportScope,
    exportTimestamps,
  ]);

  const handleExportNotes = useCallback(() => {
    const result = buildCurrentNotesExport();
    if (!result || !result.hasContent) return;

    const blob = new Blob([result.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  }, [buildCurrentNotesExport]);

  const handleCopyNotes = useCallback(() => {
    const result = buildCurrentNotesExport();
    if (!result || !result.hasContent) return;
    navigator.clipboard?.writeText(result.content).then(() => {
      setCopiedNotes(true);
      setTimeout(() => setCopiedNotes(false), 2000);
    }).catch(() => {});
  }, [buildCurrentNotesExport]);

  // Per-course playback rate, falling back to the global saved speed
  const [globalPlaybackRate, setGlobalPlaybackRate] = useState<number>(() =>
    typeof window !== "undefined" ? readGlobalPlaybackRate() : 1,
  );
  const playbackRate = courseSettings.playbackRate ?? globalPlaybackRate;

  // Volume/mute persist across lessons. The MediaPlayer remounts while the next
  // video URL loads, so without this it would fall back to full volume.
  const [volume, setVolume] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem("foleyo_volume") ?? "");
    return !isNaN(saved) && saved >= 0 && saved <= 1 ? saved : 1;
  });
  const [muted, setMuted] = useState<boolean>(
    () => localStorage.getItem("foleyo_muted") === "true",
  );

  const handleVolumeChange = useCallback(
    (detail: { volume: number; muted: boolean }) => {
      setVolume(detail.volume);
      setMuted(detail.muted);
      localStorage.setItem("foleyo_volume", detail.volume.toString());
      localStorage.setItem("foleyo_muted", detail.muted.toString());
    },
    [],
  );

  // Pick the default subtitle track from the latest persisted preference
  // whenever a lesson's subtitle tracks load.
  const defaultSubtitleLang = useMemo(
    () => pickDefaultSubtitle(subtitleTracks, readCaptionPreference()),
    [subtitleTracks],
  );

  // Build chapter cues for text/description chapter files once duration is known
  const chapterCues = useMemo(() => {
    if (chapters?.kind !== "list" || videoDuration <= 0) return [];
    return chaptersToCues(chapters.chapters, videoDuration);
  }, [chapters, videoDuration]);

  // Apply an explicit one-shot seek request (e.g. from subtitle search or ⌘K)
  useEffect(() => {
    if (!pendingSeek || !currentLesson || !isReady || !playerRef.current) return;
    if (pendingSeek.lessonId !== currentLesson.id) return;

    playerRef.current.currentTime = pendingSeek.time;
    hasRestoredRef.current = currentLesson.id;
    clearPendingSeek();
    playerRef.current.play().catch(() => {});
  }, [pendingSeek, currentLesson, isReady, clearPendingSeek]);

  // Restore position (or skip intro for unwatched lessons) when lesson changes
  useEffect(() => {
    if (!currentLesson || !isReady || !playerRef.current) return;
    if (pendingSeek && pendingSeek.lessonId === currentLesson.id) return;
    if (hasRestoredRef.current === currentLesson.id) return;

    const lessonProgress = getLessonProgress(progress, currentLesson.id);
    const dur = playerRef.current.duration;
    const hasDuration = Number.isFinite(dur) && dur > 0;

    if (lessonProgress.lastPosition > 2) {
      playerRef.current.currentTime = lessonProgress.lastPosition;
    } else if (introSkip > 0) {
      const safeMax = hasDuration ? dur - outroSkip - 1 : Infinity;
      if (introSkip < safeMax) {
        playerRef.current.currentTime = introSkip;
      }
    }
    hasRestoredRef.current = currentLesson.id;
  }, [currentLesson, isReady, progress, introSkip, outroSkip, pendingSeek]);

  // Flush any accumulated watch time and reset per-video refs when videoUrl changes
  useEffect(() => {
    // Before resetting, check if we're currently in fullscreen
    if (document.fullscreenElement) {
      wasFullscreenRef.current = true;
    }
    if (accumulatedWatchRef.current >= 1) {
      recordWatchSeconds(accumulatedWatchRef.current);
      accumulatedWatchRef.current = 0;
    }
    lastWatchTickRef.current = null;
    hasRestoredRef.current = null;
    outroTriggeredRef.current = false;
  }, [videoUrl]);

  // Flush remaining watch time on unmount
  useEffect(() => {
    return () => {
      if (accumulatedWatchRef.current >= 1) {
        recordWatchSeconds(accumulatedWatchRef.current);
        accumulatedWatchRef.current = 0;
      }
    };
  }, []);

  // Track fullscreen state changes from the browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeActive = Boolean(document.fullscreenElement);
      setIsNativeFullscreen(nativeActive);
      if (nativeActive) {
        // Keep window fullscreen and native fullscreen mutually exclusive
        exitWindowFullscreen();
      } else {
        // If user manually exited fullscreen (e.g. pressed Esc), clear the flag
        wasFullscreenRef.current = false;
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [exitWindowFullscreen]);

  // Keep keyboard focus on the player when entering window fullscreen so
  // Space / arrows / f / Escape work immediately.
  useEffect(() => {
    if (windowFullscreen) {
      playerContainerRef.current?.focus();
    }
  }, [windowFullscreen]);

  const remote = useMediaRemote(playerRef);

  const handleToggleWindowFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    toggleWindowFullscreen();
  }, [toggleWindowFullscreen]);

  const handleToggleNativeFullscreen = useCallback(() => {
    if (windowFullscreen) {
      exitWindowFullscreen();
    }
    remote.toggleFullscreen();
  }, [windowFullscreen, exitWindowFullscreen, remote]);

  // Vidstack passes the new rate as the first argument (detail)
  const applyPlaybackRate = useCallback(
    (rawRate: number, syncRemote: boolean) => {
      const rate = clampPlaybackRate(rawRate);
      if (course?.name) {
        if (courseSettings.playbackRate !== rate) {
          updateCourseSettings(course.name, { playbackRate: rate });
        }
      }
      setGlobalPlaybackRate(rate);
      try {
        localStorage.setItem(GLOBAL_SPEED_KEY, rate.toString());
      } catch {
        // storage unavailable
      }
      if (syncRemote && remote) {
        remote.changePlaybackRate(rate);
      }
    },
    [course, courseSettings.playbackRate, remote],
  );

  const handleRateChange = useCallback(
    (rate: number) => {
      applyPlaybackRate(rate, false);
    },
    [applyPlaybackRate],
  );

  const handleToolbarRateChange = useCallback(
    (rate: number) => {
      applyPlaybackRate(rate, true);
    },
    [applyPlaybackRate],
  );

  const handleIntroSkipChange = useCallback(
    (seconds: number) => {
      if (!course?.name) return;
      updateCourseSettings(course.name, {
        introSkip: sanitizeSkipSeconds(seconds),
      });
    },
    [course],
  );

  const handleOutroSkipChange = useCallback(
    (seconds: number) => {
      if (!course?.name) return;
      updateCourseSettings(course.name, {
        outroSkip: sanitizeSkipSeconds(seconds),
      });
    },
    [course],
  );

  const handleLoopStep = useCallback(() => {
    if (!videoUrl || !playerRef.current) return;
    const now = playerRef.current.currentTime;
    if (!Number.isFinite(now)) return;

    if (loop.a === null) {
      setLoopState({ url: videoUrl, range: { a: now, b: null } });
    } else if (loop.b === null) {
      if (now > loop.a + 0.5) {
        setLoopState({ url: videoUrl, range: { a: loop.a, b: now } });
        playerRef.current.currentTime = loop.a;
      } else if (now < loop.a - 0.5) {
        setLoopState({ url: videoUrl, range: { a: now, b: loop.a } });
        playerRef.current.currentTime = now;
      } else {
        setLoopState({ url: videoUrl, range: { a: now, b: null } });
      }
    } else {
      setLoopState({ url: videoUrl, range: { a: null, b: null } });
    }
  }, [videoUrl, loop]);

  const handleLoopClear = useCallback(() => {
    setLoopState({ url: videoUrl, range: { a: null, b: null } });
  }, [videoUrl]);

  const handleAddBookmark = useCallback(() => {
    if (!course?.name || !currentLesson) return;
    const player = playerRef.current;
    const now = player ? player.currentTime : 0;
    if (player && !player.paused) {
      resumeAfterBookmarkRef.current = true;
      player.pause();
    } else {
      resumeAfterBookmarkRef.current = false;
    }
    const bookmark = addBookmark(course.name, currentLesson.id, now);
    setBookmarkFocus({ id: bookmark.id, nonce: Date.now() });
  }, [course, currentLesson]);

  const handleSeekTo = useCallback((time: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = time;
    playerContainerRef.current?.focus();
  }, []);

  const handleBookmarkDoneEditing = useCallback(() => {
    playerContainerRef.current?.focus();
    if (resumeAfterBookmarkRef.current) {
      resumeAfterBookmarkRef.current = false;
      playerRef.current?.play().catch(() => {});
    }
  }, []);

  const keyShortcuts = useMemo<MediaKeyShortcuts>(
    () => ({
      toggleFullscreen: {
        keys: "f",
        onKeyDown: ({ event }) => {
          event.preventDefault();
          handleToggleWindowFullscreen();
        },
      },
      toggleNativeFullscreen: {
        keys: "Shift+f",
        onKeyDown: ({ event }) => {
          event.preventDefault();
          handleToggleNativeFullscreen();
        },
      },
      speedUp: {
        keys: ">",
        onKeyDown: ({ event }) => {
          event.preventDefault();
          applyPlaybackRate(stepPlaybackRate(playbackRate, 1), true);
        },
      },
      slowDown: {
        keys: "<",
        onKeyDown: ({ event }) => {
          event.preventDefault();
          applyPlaybackRate(stepPlaybackRate(playbackRate, -1), true);
        },
      },
    }),
    [
      handleToggleWindowFullscreen,
      handleToggleNativeFullscreen,
      applyPlaybackRate,
      playbackRate,
    ],
  );

  const layoutSlots = useMemo(
    () => ({
      beforeFullscreenButton: (
        <MonitorFullscreenButton
          active={isNativeFullscreen}
          onToggle={handleToggleNativeFullscreen}
        />
      ),
      fullscreenButton: (
        <WindowFullscreenButton
          active={windowFullscreen}
          onToggle={handleToggleWindowFullscreen}
        />
      ),
    }),
    [
      isNativeFullscreen,
      handleToggleNativeFullscreen,
      windowFullscreen,
      handleToggleWindowFullscreen,
    ],
  );

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      const now = detail.currentTime;
      updatePosition(now);

      // Update synced transcript time (quantized to 0.25s to keep renders light)
      setCurrentTime((prev) => (Math.abs(prev - now) >= 0.25 ? now : prev));

      // Accumulate real watched seconds for daily streak & watch history
      if (videoUrl && playerRef.current && !playerRef.current.paused) {
        const last = lastWatchTickRef.current;
        if (last && last.url === videoUrl) {
          const mediaDelta = now - last.time;
          // Ignore seeks, pauses, or jumps (> 5s media time between ticks)
          if (mediaDelta > 0 && mediaDelta <= 5) {
            const wallDelta = mediaDelta / Math.max(0.25, playbackRate);
            accumulatedWatchRef.current += wallDelta;
            if (accumulatedWatchRef.current >= 5) {
              recordWatchSeconds(accumulatedWatchRef.current);
              accumulatedWatchRef.current = 0;
            }
          }
        }
        lastWatchTickRef.current = { url: videoUrl, time: now };
      } else if (videoUrl) {
        lastWatchTickRef.current = { url: videoUrl, time: now };
      }

      // A–B loop enforcement
      if (
        loop.a !== null &&
        loop.b !== null &&
        playerRef.current &&
        now >= loop.b
      ) {
        playerRef.current.currentTime = loop.a;
        return;
      }

      // Outro skip (disabled while looping a section)
      if (outroSkip > 0 && (loop.a === null || loop.b === null)) {
        const dur = playerRef.current?.duration ?? 0;
        if (Number.isFinite(dur) && dur > introSkip + outroSkip + 2) {
          const cutoff = dur - outroSkip;
          if (now >= cutoff && !outroTriggeredRef.current) {
            outroTriggeredRef.current = true;
            playerRef.current?.pause();
            onVideoEnded();
            return;
          } else if (now < cutoff - 2 && outroTriggeredRef.current) {
            outroTriggeredRef.current = false;
          }
        }
      }

      // Highlight the most recent bookmark at or before currentTime
      if (lessonBookmarks.length > 0) {
        let currentId: string | null = null;
        for (let i = lessonBookmarks.length - 1; i >= 0; i--) {
          if (lessonBookmarks[i].time <= now + 0.5) {
            currentId = lessonBookmarks[i].id;
            break;
          }
        }
        if (currentId !== activeBookmarkId) {
          setActiveBookmarkState({ url: videoUrl, id: currentId });
        }
      } else if (activeBookmarkId !== null) {
        setActiveBookmarkState({ url: videoUrl, id: null });
      }
    },
    [
      updatePosition,
      playbackRate,
      loop,
      outroSkip,
      introSkip,
      onVideoEnded,
      lessonBookmarks,
      activeBookmarkId,
      videoUrl,
    ],
  );

  const handleCanPlay = useCallback(() => {
    setReadyUrl(videoUrl);
    // Explicitly set the remote playback rate as Vidstack doesn't automatically sync the prop
    if (remote) {
      remote.changePlaybackRate(playbackRate);
    }
    // Same for volume/mute: re-apply the persisted level in case the prop didn't sync
    const player = playerRef.current;
    if (player) {
      if (player.volume !== volume) player.volume = volume;
      if (player.muted !== muted) player.muted = muted;
    }
    // Report video duration to the context for watch time stats and chapter cues
    if (currentLesson && playerRef.current) {
      const dur = playerRef.current.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setLessonDuration(currentLesson.id, dur);
        setDurationState({ url: videoUrl, duration: dur });
      }
    }
    // Re-enter fullscreen if we were in fullscreen before the lesson changed
    if (wasFullscreenRef.current && playerContainerRef.current) {
      wasFullscreenRef.current = false;
      playerContainerRef.current.requestFullscreen?.().catch(() => {
        // Fullscreen request may fail if not triggered by user gesture
      });
    }
  }, [remote, playbackRate, volume, muted, currentLesson, setLessonDuration, videoUrl]);

  const handleDurationChange = useCallback(
    (dur: number) => {
      if (dur && Number.isFinite(dur) && dur > 0) {
        setDurationState({ url: videoUrl, duration: dur });
      }
    },
    [videoUrl],
  );

  const handleEnded = useCallback(() => {
    if (loop.a !== null && loop.b !== null && playerRef.current) {
      playerRef.current.currentTime = loop.a;
      playerRef.current.play().catch(() => {});
      return;
    }
    onVideoEnded();
  }, [loop, onVideoEnded]);

  // Determine if prev/next are available (over visible, non-hidden lessons)
  const allLessons = useMemo(
    () => getVisibleLessons(course, lessonOverrides),
    [course, lessonOverrides],
  );
  const currentIdx = currentLesson
    ? allLessons.findIndex((l) => l.id === currentLesson.id)
    : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx !== -1 && currentIdx < allLessons.length - 1;

  // Global keyboard shortcuts for study & lesson navigation (ignored in inputs)
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target) || isEditable(document.activeElement)) return;

      if (e.shiftKey && e.key === "N") {
        if (hasNext) {
          e.preventDefault();
          nextLesson();
        }
      } else if (e.shiftKey && e.key === "P") {
        if (hasPrev) {
          e.preventDefault();
          prevLesson();
        }
      } else if (!e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleAddBookmark();
      } else if (e.shiftKey && e.key === "A") {
        if (loop.a !== null) {
          e.preventDefault();
          handleLoopClear();
        }
      } else if (!e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleLoopStep();
      } else if (!e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleTranscript();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    hasNext,
    hasPrev,
    nextLesson,
    prevLesson,
    handleAddBookmark,
    handleLoopStep,
    handleLoopClear,
    toggleTranscript,
    loop.a,
  ]);

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

  // MIME hint when vidstack knows the container; a plain src otherwise —
  // the video provider still plays MKV/MOV (the browser sniffs blob content).
  const videoMimeType = getVideoMimeType(currentLesson.fileName);
  const currentModule = course?.modules.find(
    (m) => m.id === currentLesson.moduleId,
  );
  const moduleWatchStats = computeModuleWatchTimeStats(
    currentModule,
    progress,
    lessonDurations,
    lessonOverrides.hidden,
  );
  const hasAnyCourseSubtitles =
    subtitleTracks.length > 0 ||
    Boolean(
      course?.modules.some((m) =>
        m.lessons.some((l) => l.subtitles && l.subtitles.length > 0),
      ),
    );
  const codecHelp = buildCodecHelp(currentLesson.fileName);
  const showTranscriptPanel = transcriptOpen && !windowFullscreen;

  return (
    <div
      className={`flex-1 flex flex-col items-center ${
        windowFullscreen ? "overflow-hidden" : "overflow-y-auto"
      }`}
    >
      <div
        className={`w-full px-4 py-6 ${
          showTranscriptPanel ? "max-w-360" : "max-w-240"
        } ${windowFullscreen ? "" : "animate-fade-in"}`}
      >
        <div
          className={
            showTranscriptPanel
              ? "flex flex-col lg:flex-row lg:items-start gap-6"
              : ""
          }
        >
          <div className={showTranscriptPanel ? "flex-1 min-w-0" : ""}>
        {/* Lesson title */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
              <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wider">
                {currentModule?.title}
              </p>
              {moduleWatchStats.totalSeconds > 0 && (
                <span className="text-[11px] font-mono text-foreground-muted">
                  ·{" "}
                  {moduleWatchStats.remainingSeconds > 0
                    ? `${formatDuration(moduleWatchStats.remainingSeconds)} left in module`
                    : "Module done"}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              {getDisplayTitle(currentLesson, lessonOverrides)}
            </h1>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {hasAnyCourseSubtitles && (
              <button
                type="button"
                onClick={toggleTranscript}
                aria-pressed={transcriptOpen}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${FOCUS_RING} ${
                  transcriptOpen
                    ? "bg-accent/15 border-accent/30 text-accent hover:bg-accent/20"
                    : "bg-surface hover:bg-surface-hover border-border text-foreground-muted hover:text-foreground"
                }`}
                title="Toggle transcript & subtitle search (T)"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <line x1="8" y1="9" x2="16" y2="9" />
                  <line x1="8" y1="13" x2="13" y2="13" />
                </svg>
                <span className="hidden sm:inline">Transcript</span>
              </button>
            )}
            <button
              onClick={() => markComplete(currentLesson.id)}
              aria-pressed={getLessonProgress(progress, currentLesson.id).completed}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${FOCUS_RING} ${
                getLessonProgress(progress, currentLesson.id).completed
                  ? "bg-success/15 border-success/30 text-success hover:bg-success/20"
                  : "bg-surface hover:bg-surface-hover border-border text-foreground-muted hover:text-foreground"
              }`}
              title={
                getLessonProgress(progress, currentLesson.id).completed
                  ? "Mark lesson as incomplete"
                  : "Mark lesson as complete"
              }
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="hidden sm:inline">
                {getLessonProgress(progress, currentLesson.id).completed
                  ? "Completed"
                  : "Mark complete"}
              </span>
            </button>
          </div>
        </div>

        {/* Video player */}
        <div
          ref={playerContainerRef}
          tabIndex={-1}
          data-window-fullscreen={windowFullscreen ? "true" : undefined}
          className={
            windowFullscreen
              ? "fixed inset-0 z-40 w-screen h-screen bg-black focus:outline-none"
              : "rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-white/5 relative aspect-video focus:outline-none"
          }
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
              src={videoMimeType ? { src: videoUrl, type: videoMimeType } : videoUrl}
              crossOrigin=""
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onCanPlay={handleCanPlay}
              onEnded={handleEnded}
              onError={() => setMediaErrorUrl(videoUrl)}
              onRateChange={handleRateChange}
              onTextTrackChange={(track, nativeEvent) => {
                if (subtitleTracks.length === 0 || !nativeEvent.trigger) return;
                saveCaptionPreference(track ? track.language : null);
              }}
              onVolumeChange={handleVolumeChange}
              playbackRate={playbackRate}
              volume={volume}
              muted={muted}
              autoPlay
              className="w-full h-full"
              keyTarget="player"
              keyShortcuts={keyShortcuts}
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
                    default={defaultSubtitleLang === track.language}
                  />
                ))}
                {chapters?.kind === "vtt" && (
                  <Track
                    key={`chapters-${chapters.src}`}
                    src={chapters.src}
                    kind="chapters"
                    label="Chapters"
                    default
                  />
                )}
                {chapters?.kind === "list" && chapterCues.length > 0 && (
                  <Track
                    key={`chapters-${currentLesson.id}-${videoDuration}`}
                    content={{ cues: chapterCues }}
                    kind="chapters"
                    label="Chapters"
                    default
                  />
                )}
              </MediaProvider>
              <DefaultVideoLayout
                icons={defaultLayoutIcons}
                thumbnails={seekThumbnails}
                playbackRates={playbackRateOptions(playbackRate)}
                slots={layoutSlots}
              />
            </MediaPlayer>
          )}

          {/* Codec / playback error overlay with tailored ffmpeg commands */}
          {hasMediaError && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-5 overflow-y-auto"
              role="alert"
            >
              <div className="max-w-lg w-full space-y-3 text-left">
                <div className="flex items-start gap-2.5">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-warning shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {codecHelp.headline}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">
                      {codecHelp.explanation}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                        Fast fix (keep video, convert audio to AAC)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCommand(codecHelp.remuxCommand)}
                        className="font-mono text-[10px] text-accent-hover hover:underline"
                      >
                        {copiedCmd === codecHelp.remuxCommand ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <code className="block font-mono text-[11px] text-white/90 break-all select-all">
                      {codecHelp.remuxCommand}
                    </code>
                  </div>

                  <div className="rounded-lg bg-white/5 border border-white/10 p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                        Full transcode (H.264 + AAC — plays everywhere)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCommand(codecHelp.transcodeCommand)}
                        className="font-mono text-[10px] text-accent-hover hover:underline"
                      >
                        {copiedCmd === codecHelp.transcodeCommand ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <code className="block font-mono text-[11px] text-white/90 break-all select-all">
                      {codecHelp.transcodeCommand}
                    </code>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMediaErrorUrl(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors ${FOCUS_RING}`}
                  >
                    Retry playback
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-advance countdown overlay */}
          {pendingNext && autoAdvance && (
            <AutoAdvanceOverlay
              next={pendingNext}
              nextTitle={getDisplayTitle(pendingNext, lessonOverrides)}
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
            title="Previous lesson (Shift+P)"
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
            title="Next lesson (Shift+N)"
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

        {/* Codec-risk warning (MKV/MOV may contain codecs Chrome can't decode) */}
        {hasCodecRisk(currentLesson.fileName) && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
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
                <span>{CODEC_WARNING}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCodecFix((v) => !v)}
                className="shrink-0 font-mono text-[11px] underline hover:opacity-80"
              >
                {showCodecFix ? "Hide ffmpeg" : "ffmpeg fix"}
              </button>
            </div>
            {showCodecFix && (
              <div className="rounded-lg bg-background/70 border border-warning/20 p-2.5 flex items-center justify-between gap-2 text-foreground">
                <code className="font-mono text-[11px] break-all select-all">
                  {codecHelp.transcodeCommand}
                </code>
                <button
                  type="button"
                  onClick={() => copyCommand(codecHelp.transcodeCommand)}
                  className="shrink-0 font-mono text-[10px] text-accent hover:underline"
                >
                  {copiedCmd === codecHelp.transcodeCommand ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Per-course speed, intro/outro skip, A–B loop, and shortcuts */}
        {course && (
          <PlaybackToolbar
            courseName={course.name}
            playbackRate={playbackRate}
            onRateChange={handleToolbarRateChange}
            introSkip={introSkip}
            outroSkip={outroSkip}
            onIntroSkipChange={handleIntroSkipChange}
            onOutroSkipChange={handleOutroSkipChange}
            loop={loop}
            onLoopStep={handleLoopStep}
            onLoopClear={handleLoopClear}
          />
        )}

        {/* Timestamped Bookmarks */}
        {course && (
          <BookmarksPanel
            courseId={course.name}
            lessonId={currentLesson.id}
            bookmarks={lessonBookmarks}
            activeId={activeBookmarkId}
            focusRequest={bookmarkFocus}
            onSeek={handleSeekTo}
            onAdd={handleAddBookmark}
            onDoneEditing={handleBookmarkDoneEditing}
          />
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
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={!hasAnyNotes}
                aria-expanded={exportMenuOpen}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${FOCUS_RING} ${
                  hasAnyNotes
                    ? "bg-accent/10 text-accent hover:bg-accent hover:text-white"
                    : "bg-surface text-foreground-muted cursor-not-allowed"
                }`}
                title={
                  hasAnyNotes
                    ? "Export notes (Markdown, Obsidian, or Notion)"
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
                Export
              </button>
            </div>
          </div>

          {exportMenuOpen && hasAnyNotes && (
            <div className="px-5 py-3.5 border-b border-border bg-background/60 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-foreground-subtle font-medium">Scope</span>
                <div className="inline-flex rounded-lg bg-surface p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setExportScope("course")}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      exportScope === "course"
                        ? "bg-accent/15 text-accent font-medium"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    Whole course
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportScope("module")}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      exportScope === "module"
                        ? "bg-accent/15 text-accent font-medium"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    This module
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-foreground-subtle font-medium">Format</span>
                <div className="inline-flex rounded-lg bg-surface p-0.5 border border-border">
                  {(
                    [
                      ["markdown", "Markdown"],
                      ["obsidian", "Obsidian"],
                      ["notion", "Notion"],
                    ] as const
                  ).map(([fmt, label]) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`px-2 py-0.5 rounded-md transition-colors ${
                        exportFormat === fmt
                          ? "bg-accent/15 text-accent font-medium"
                          : "text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-foreground-muted hover:text-foreground">
                <input
                  type="checkbox"
                  checked={exportTimestamps}
                  onChange={(e) => setExportTimestamps(e.target.checked)}
                />
                Timestamps
              </label>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleCopyNotes}
                  className={`px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-hover text-foreground transition-colors ${FOCUS_RING}`}
                >
                  {copiedNotes ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleExportNotes}
                  className={`px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors ${FOCUS_RING}`}
                >
                  Download .md
                </button>
              </div>
            </div>
          )}
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

          {showTranscriptPanel && (
            <div className="w-full lg:w-84 xl:w-96 shrink-0">
              <TranscriptPanel
                tracks={subtitleTracks}
                currentTime={currentTime}
                onSeek={handleSeekTo}
                onClose={toggleTranscript}
                course={course}
                currentLesson={currentLesson}
                lessonOverrides={lessonOverrides}
                onJumpToLessonCue={(lesson, time) => selectLesson(lesson, time)}
              />
            </div>
          )}
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
  nextTitle,
  endsAt,
  onCancel,
  containerRef,
}: {
  next: Lesson;
  nextTitle: string;
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
      aria-label={`Up next: ${nextTitle || next.title}. Press Escape or Cancel to stay on this lesson.`}
    >
      <div className="flex flex-col items-center gap-2.5 max-w-md px-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50">
          Up next
        </p>
        <p className="text-sm font-medium text-white line-clamp-2">
          {nextTitle || next.title}
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

/**
 * Primary fullscreen control: expands the player to fill only the current
 * browser viewport (so split-screen windows stay contained on their half of
 * the monitor).
 */
function WindowFullscreenButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const label = active ? "Exit fill window" : "Fill window";
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="vds-button"
          aria-label={label}
          aria-pressed={active}
          onClick={onToggle}
        >
          <svg
            className="vds-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {active ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content className="vds-tooltip-content" placement="top end">
        {label} (f)
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

/**
 * Secondary fullscreen control: triggers native OS/monitor fullscreen when the
 * user explicitly wants the entire display.
 */
function MonitorFullscreenButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const label = active ? "Exit monitor fullscreen" : "Monitor fullscreen";
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="vds-button"
          aria-label={label}
          aria-pressed={active}
          onClick={onToggle}
        >
          <svg
            className="vds-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content className="vds-tooltip-content" placement="top">
        {label} (Shift+F)
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
