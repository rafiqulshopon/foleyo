'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Course, Lesson, CourseProgress, hasCodecRisk } from '@/app/types';
import { parseCourseDirectory } from '@/app/lib/parse-course';
import { generateCourseThumbnail } from '@/app/lib/thumbnail-generator';
import {
  loadProgress,
  saveProgress,
  createEmptyProgress,
  updateLessonProgress,
  toggleLessonComplete,
} from '@/app/lib/progress-store';
import {
  saveRecentCourse,
  updateRecentCourseMetadata,
  getDirectoryHandle,
  getCourseCache,
  saveCourseCache,
  checkHandlePermission,
  type RecentCourse,
} from '@/app/lib/recent-courses-store';
import { useVideoLoader, type SubtitleTrack } from './use-video-loader';
import { useDurationScanner } from './use-duration-scanner';
import { useCourseHistory } from './use-course-history';
import { LessonDurationsProvider } from './lesson-durations-context';

export type { SubtitleTrack };

/** Delay before autoplay advances to the next lesson after a video ends. */
export const AUTO_ADVANCE_DELAY_MS = 5000;

/** A pending auto-advance: which lesson is next and when the countdown ends. */
export interface AutoAdvance {
  lessonId: string;
  endsAt: number;
}

interface CourseContextType {
  // State
  course: Course | null;
  currentLesson: Lesson | null;
  videoUrl: string | null;
  subtitleTracks: SubtitleTrack[];
  progress: CourseProgress;
  autoplay: boolean;
  autoAdvance: AutoAdvance | null;
  sidebarOpen: boolean;
  isLoading: boolean;
  error: string | null;
  hasUnsupportedFormat: boolean;
  requiresPermission: boolean;
  invalidLink: boolean;

  // Actions
  openFolder: () => Promise<void>;
  resumeRecentCourse: (folderName: string) => Promise<void>;
  selectLesson: (lesson: Lesson) => Promise<void>;
  nextLesson: () => void;
  prevLesson: () => void;
  toggleAutoplay: () => void;
  toggleSidebar: () => void;
  markComplete: (lessonId: string) => void;
  updatePosition: (position: number) => void;
  onVideoEnded: () => void;
  cancelAutoAdvance: () => void;
  closeCourse: () => void;
  refreshCourse: () => Promise<void>;
  grantPermission: () => Promise<void>;
}

const CourseContext = createContext<CourseContextType | null>(null);

export function useCourse() {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error('useCourse must be used within CourseProvider');
  return ctx;
}

export function CourseProvider({ children }: { children: ReactNode }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<CourseProgress>(
    createEmptyProgress('')
  );
  const [autoplay, setAutoplay] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState<AutoAdvance | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsupportedFormat, setHasUnsupportedFormat] = useState(false);
  const [requiresPermission, setRequiresPermission] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  // Video/subtitle blob-URL lifecycle, background duration scan
  const { videoUrl, subtitleTracks, loadVideo, showVideo, resetVideo } =
    useVideoLoader();
  const { lessonDurations, setLessonDuration } = useDurationScanner(course);

  // Track current directory handle for saving to recent courses
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the completed-count → recent-course metadata sync so position
  // ticks (which also change `progress`) don't trigger IndexedDB writes.
  const lastSyncedCompletedRef = useRef<{ courseName: string; completed: number } | null>(null);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  /** Dismiss a pending auto-advance countdown without advancing. */
  const cancelAutoAdvance = useCallback(() => {
    clearAutoAdvanceTimer();
    setAutoAdvance(null);
  }, [clearAutoAdvanceTimer]);

  // Single persistence funnel: every progress change is written once here.
  // (Updaters themselves are pure — StrictMode may invoke them twice.)
  useEffect(() => {
    if (!progress.courseName) return;
    saveProgress(progress);
  }, [progress]);

  const closeCourse = useCallback(
    async (isPopState = false) => {
      if (course && dirHandleRef.current) {
        try {
          const allLessons = course.modules.flatMap((m) => m.lessons);
          const completedCount = allLessons.filter(
            (l) => progress.lessons[l.id]?.completed
          ).length;

          await updateRecentCourseMetadata(dirHandleRef.current.name, {
            lastOpenedAt: Date.now(),
            completedLessons: completedCount,
            percentage:
              course.totalLessons > 0
                ? Math.round((completedCount / course.totalLessons) * 100)
                : 0,
          });
        } catch (e) {
          console.error('Failed to update recent course metadata on close', e);
        }
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      cancelAutoAdvance();
      resetVideo();
      setCourse(null);
      setCurrentLesson(null);
      dirHandleRef.current = null;

      if (!isPopState) {
        if (window.history.state?.fromDirectLink) {
          window.history.replaceState({}, '', '/');
        } else if (window.history.state?.isCourseOpen) {
          window.history.back();
        } else {
          window.history.pushState({}, '', '/');
        }
      }
    },
    [course, progress, resetVideo, cancelAutoAdvance]
  );

  useCourseHistory({
    course,
    closeCourse,
    autoAdvanceActive: autoAdvance !== null,
    cancelAutoAdvance,
  });

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  // Get all lessons flat
  const getAllLessons = useCallback((): Lesson[] => {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons);
  }, [course]);

  /**
   * Shared logic: once we have a dirHandle and a parsed course,
   * set up state, load progress, resume last lesson, and persist to IndexedDB.
   */
  const initializeCourse = useCallback(
    async (dirHandle: FileSystemDirectoryHandle, parsedCourse: Course) => {
      dirHandleRef.current = dirHandle;

      // Check for codec-risk containers (MKV/MOV)
      const hasUnsupported = parsedCourse.modules.some((m) =>
        m.lessons.some((l) => hasCodecRisk(l.fileName))
      );
      setHasUnsupportedFormat(hasUnsupported);

      setCourse(parsedCourse);

      // Load progress (persisted by the save funnel when it's fresh)
      let courseProgress = loadProgress(parsedCourse.name);
      if (!courseProgress) {
        courseProgress = createEmptyProgress(parsedCourse.name);
      }
      setProgress(courseProgress);

      // Resume last lesson or start from first
      const allLessons = parsedCourse.modules.flatMap((m) => m.lessons);
      let resumeLesson: Lesson | undefined;

      if (courseProgress.lastLessonId) {
        resumeLesson = allLessons.find(
          (l) => l.id === courseProgress!.lastLessonId
        );
      }

      if (!resumeLesson) {
        resumeLesson = allLessons[0];
      }

      if (resumeLesson) {
        const url = await loadVideo(resumeLesson);
        showVideo(url);
        setCurrentLesson(resumeLesson);
      }

      // Find the current lesson info for the recent course card
      const currentLessonForCard = resumeLesson || allLessons[0];
      const currentModule = parsedCourse.modules.find(
        (m) => m.id === currentLessonForCard?.moduleId
      );

      // Calculate completed count from progress
      const completedCount = allLessons.filter(
        (l) => courseProgress!.lessons[l.id]?.completed
      ).length;
      // saveRecentCourse below writes this count; remember it so the
      // metadata-sync effect doesn't immediately write the same thing.
      lastSyncedCompletedRef.current = {
        courseName: parsedCourse.name,
        completed: completedCount,
      };

      const recentEntry: RecentCourse = {
        name: parsedCourse.name,
        folderName: dirHandle.name,
        totalLessons: parsedCourse.totalLessons,
        completedLessons: completedCount,
        totalModules: parsedCourse.modules.length,
        lastOpenedAt: Date.now(),
        lastLessonTitle: currentLessonForCard?.title || '',
        lastLessonModule: currentModule?.title || '',
        percentage:
          parsedCourse.totalLessons > 0
            ? Math.round((completedCount / parsedCourse.totalLessons) * 100)
            : 0,
      };
      await saveRecentCourse(recentEntry, dirHandle);

      // Trigger thumbnail generation in the background
      const firstLesson = parsedCourse.modules[0]?.lessons[0];
      if (firstLesson) {
        generateCourseThumbnail(parsedCourse.name, firstLesson).catch(console.error);
      }

      setCourse(parsedCourse);
      await saveCourseCache(dirHandle.name, parsedCourse);

      const urlParam = `?course=${encodeURIComponent(dirHandle.name)}`;
      if (window.location.search === urlParam) {
        window.history.replaceState({ isCourseOpen: true, fromDirectLink: true }, '', urlParam);
      } else if (!window.history.state?.isCourseOpen) {
        window.history.pushState({ isCourseOpen: true, fromDirectLink: false }, '', urlParam);
      } else {
        window.history.replaceState({ isCourseOpen: true, fromDirectLink: false }, '', urlParam);
      }
    },
    [loadVideo, showVideo]
  );

  // Open folder picker
  const openFolder = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check browser support
      if (!('showDirectoryPicker' in window)) {
        setError(
          'Your browser does not support the File System Access API. Please use Chrome or Edge.'
        );
        setIsLoading(false);
        return;
      }

      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const parsedCourse = await parseCourseDirectory(dirHandle);

      if (parsedCourse.totalLessons === 0) {
        setError(
          'No video files found in the selected folder. Make sure your course folder contains .mp4, .m4v, .webm, .ogv, .mkv, or .mov files.'
        );
        setIsLoading(false);
        return;
      }

      await initializeCourse(dirHandle, parsedCourse);
      setIsLoading(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User cancelled picker
        setIsLoading(false);
        return;
      }
      console.error('Error opening folder:', e);
      setError(`Failed to open folder: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  }, [initializeCourse]);

  // Resume a recently opened course from IndexedDB handle
  const resumeRecentCourse = useCallback(
    async (folderName: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const handle = await getDirectoryHandle(folderName);
        if (!handle) {
          setError('Course folder handle not found. Please open the folder again.');
          setIsLoading(false);
          return;
        }

        // Request permission (may show a prompt)
        const permission = await handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          setError('Permission denied. Please grant access to continue.');
          setIsLoading(false);
          return;
        }

        const parsedCourse = await parseCourseDirectory(handle);

        if (parsedCourse.totalLessons === 0) {
          setError('No video files found. The folder may have been moved or deleted.');
          setIsLoading(false);
          return;
        }

        await initializeCourse(handle, parsedCourse);
        setIsLoading(false);
      } catch (e) {
        console.error('Error resuming course:', e);
        setError(
          `Failed to resume course: ${e instanceof Error ? e.message : 'Unknown error'}. Try opening the folder again.`
        );
        setIsLoading(false);
      }
    },
    [initializeCourse]
  );

  // Select a specific lesson
  const selectLesson = useCallback(
    async (lesson: Lesson) => {
      cancelAutoAdvance(); // manual navigation cancels any pending countdown
      setError(null);
      try {
        const url = await loadVideo(lesson);
        showVideo(url);
        setCurrentLesson(lesson);
        setProgress((prev) => updateLessonProgress(prev, lesson.id, {}));
      } catch (e) {
        console.error('Error loading lesson:', e);
        setError(`Failed to load video: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    },
    [loadVideo, showVideo, cancelAutoAdvance]
  );

  // Refresh course to detect new files
  const refreshCourse = useCallback(async () => {
    if (!dirHandleRef.current || !course) return;
    setIsLoading(true);
    setError(null);
    try {
      const parsedCourse = await parseCourseDirectory(dirHandleRef.current);
      await saveCourseCache(dirHandleRef.current.name, parsedCourse);
      setCourse(parsedCourse);

      if (currentLesson) {
        const allLessons = parsedCourse.modules.flatMap(m => m.lessons);
        const newLessonRef = allLessons.find(l => l.id === currentLesson.id);
        if (newLessonRef) {
          setCurrentLesson(newLessonRef);
        }
      }
    } catch (e) {
      console.error('Failed to refresh course:', e);
      setError(
        `Failed to refresh course folder: ${e instanceof Error ? e.message : 'Unknown error'}. The folder may have been moved, renamed, or disconnected.`
      );
    } finally {
      setIsLoading(false);
    }
  }, [course, currentLesson]);

  // Navigate to next lesson
  const nextLesson = useCallback(() => {
    if (!currentLesson || !course) return;
    const allLessons = getAllLessons();
    const currentIdx = allLessons.findIndex((l) => l.id === currentLesson.id);
    if (currentIdx < allLessons.length - 1) {
      selectLesson(allLessons[currentIdx + 1]);
    }
  }, [currentLesson, course, getAllLessons, selectLesson]);

  // Navigate to previous lesson
  const prevLesson = useCallback(() => {
    if (!currentLesson || !course) return;
    const allLessons = getAllLessons();
    const currentIdx = allLessons.findIndex((l) => l.id === currentLesson.id);
    if (currentIdx > 0) {
      selectLesson(allLessons[currentIdx - 1]);
    }
  }, [currentLesson, course, getAllLessons, selectLesson]);

  // Handle video ended
  const onVideoEnded = useCallback(() => {
    if (!currentLesson) return;

    // Mark current lesson as complete
    setProgress((prev) =>
      updateLessonProgress(prev, currentLesson.id, {
        completed: true,
        lastPosition: 0,
      })
    );

    // Auto-play next if enabled — after a cancelable countdown
    if (autoplay) {
      const allLessons = getAllLessons();
      const currentIdx = allLessons.findIndex(
        (l) => l.id === currentLesson.id
      );
      const next =
        currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
      if (next) {
        clearAutoAdvanceTimer();
        setAutoAdvance({
          lessonId: next.id,
          endsAt: Date.now() + AUTO_ADVANCE_DELAY_MS,
        });
        autoAdvanceTimerRef.current = setTimeout(() => {
          autoAdvanceTimerRef.current = null;
          setAutoAdvance(null);
          selectLesson(next);
        }, AUTO_ADVANCE_DELAY_MS);
      }
    }
  }, [currentLesson, autoplay, getAllLessons, selectLesson, clearAutoAdvanceTimer]);

  // Toggle autoplay
  const toggleAutoplay = useCallback(() => {
    setAutoplay((prev) => !prev);
    // Turning autoplay off also dismisses a pending countdown
    if (autoplay) cancelAutoAdvance();
  }, [autoplay, cancelAutoAdvance]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Mark lesson complete/incomplete (updater is pure; the metadata sync
  // effect below reacts to the completed-count change)
  const markComplete = useCallback((lessonId: string) => {
    setProgress((prev) => toggleLessonComplete(prev, lessonId));
  }, []);

  // Sync the completed count to the recent-courses card — only when the
  // count actually changes for this course.
  useEffect(() => {
    if (!course || !dirHandleRef.current) return;

    const allLessons = course.modules.flatMap((m) => m.lessons);
    const completedCount = allLessons.filter(
      (l) => progress.lessons[l.id]?.completed
    ).length;

    const last = lastSyncedCompletedRef.current;
    if (last && last.courseName === course.name && last.completed === completedCount) {
      return;
    }
    lastSyncedCompletedRef.current = {
      courseName: course.name,
      completed: completedCount,
    };

    updateRecentCourseMetadata(dirHandleRef.current.name, {
      completedLessons: completedCount,
      percentage:
        course.totalLessons > 0
          ? Math.round((completedCount / course.totalLessons) * 100)
          : 0,
    }).catch((e) => console.error('Failed to sync course metadata', e));
  }, [course, progress]);

  // Update playback position (debounced save)
  const updatePosition = useCallback(
    (position: number) => {
      if (!currentLesson) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(() => {
        setProgress((prev) =>
          updateLessonProgress(prev, currentLesson.id, {
            lastPosition: position,
          })
        );
      }, 2000); // Save every 2 seconds at most
    },
    [currentLesson]
  );

  const grantPermission = useCallback(async () => {
    if (!dirHandleRef.current || !course) return;
    try {
      const status = await dirHandleRef.current.requestPermission({ mode: 'read' });
      if (status === 'granted') {
        setRequiresPermission(false);
        if (currentLesson) {
          const url = await loadVideo(currentLesson);
          showVideo(url);
        }
      }
    } catch (e) {
      console.warn('Failed to grant permission', e);
    }
  }, [course, currentLesson, loadVideo, showVideo]);

  // Read URL param on mount to restore cached course state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const courseParam = params.get('course');
    if (!courseParam) return;

    let isCancelled = false;
    async function loadFromCache() {
      setIsLoading(true);
      const dirHandle = await getDirectoryHandle(courseParam!);
      const courseCache = await getCourseCache(courseParam!);

      if (isCancelled) return;

      if (!dirHandle || !courseCache) {
        setInvalidLink(true);
        setIsLoading(false);
        return;
      }

      const status = await checkHandlePermission(courseParam!);
      if (status === 'granted') {
        await initializeCourse(dirHandle, courseCache);
        setIsLoading(false);
        return;
      }

      dirHandleRef.current = dirHandle;

      const hasUnsupported = courseCache.modules.some((m) =>
        m.lessons.some((l) => hasCodecRisk(l.fileName))
      );
      setHasUnsupportedFormat(hasUnsupported);
      setCourse(courseCache);

      let courseProgress = loadProgress(courseCache.name);
      if (!courseProgress) {
        courseProgress = createEmptyProgress(courseCache.name);
      }
      setProgress(courseProgress);

      const allLessons = courseCache.modules.flatMap((m) => m.lessons);
      const resumeLesson = allLessons.find((l) => l.id === courseProgress!.lastLessonId) || allLessons[0];

      setCurrentLesson(resumeLesson);
      setRequiresPermission(true);
      setIsLoading(false);
    }

    loadFromCache();

    return () => { isCancelled = true; };
  }, [initializeCourse]);

  const value = useMemo(
    () => ({
      course,
      currentLesson,
      videoUrl,
      subtitleTracks,
      progress,
      autoplay,
      autoAdvance,
      sidebarOpen,
      isLoading,
      error,
      hasUnsupportedFormat,
      requiresPermission,
      invalidLink,
      openFolder,
      resumeRecentCourse,
      selectLesson,
      nextLesson,
      prevLesson,
      toggleAutoplay,
      toggleSidebar,
      markComplete,
      updatePosition,
      onVideoEnded,
      cancelAutoAdvance,
      closeCourse,
      refreshCourse,
      grantPermission,
    }),
    [
      course,
      currentLesson,
      videoUrl,
      subtitleTracks,
      progress,
      autoplay,
      autoAdvance,
      sidebarOpen,
      isLoading,
      error,
      hasUnsupportedFormat,
      requiresPermission,
      invalidLink,
      openFolder,
      resumeRecentCourse,
      selectLesson,
      nextLesson,
      prevLesson,
      toggleAutoplay,
      toggleSidebar,
      markComplete,
      updatePosition,
      onVideoEnded,
      cancelAutoAdvance,
      closeCourse,
      refreshCourse,
      grantPermission,
    ]
  );

  return (
    <CourseContext.Provider value={value}>
      <LessonDurationsProvider
        lessonDurations={lessonDurations}
        setLessonDuration={setLessonDuration}
      >
        {children}
      </LessonDurationsProvider>
    </CourseContext.Provider>
  );
}
