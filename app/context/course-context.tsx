'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { Course, Lesson, CourseProgress } from '@/app/types';
import { parseCourseDirectory } from '@/app/lib/parse-course';
import {
  loadProgress,
  saveProgress,
  createEmptyProgress,
  updateLessonProgress,
  toggleLessonComplete,
  getLessonProgress,
  getCompletionStats,
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
import { loadSubtitle } from '@/app/lib/subtitles';

export interface SubtitleTrack {
  src: string;
  language: string;
  label: string;
}

interface CourseContextType {
  // State
  course: Course | null;
  currentLesson: Lesson | null;
  videoUrl: string | null;
  subtitleTracks: SubtitleTrack[];
  progress: CourseProgress;
  autoplay: boolean;
  sidebarOpen: boolean;
  isLoading: boolean;
  error: string | null;
  hasMkvFiles: boolean;
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
  getModuleStats: (moduleId: string) => { completed: number; total: number; percentage: number };
  getOverallStats: () => { completed: number; total: number; percentage: number };
  closeCourse: () => void;
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [progress, setProgress] = useState<CourseProgress>(
    createEmptyProgress('')
  );
  const [autoplay, setAutoplay] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMkvFiles, setHasMkvFiles] = useState(false);
  const [requiresPermission, setRequiresPermission] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  // Track current directory handle for saving to recent courses
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup object URL on unmount or URL change
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

  useEffect(() => {
    return () => {
      revokeUrl();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [revokeUrl]);

  const closeCourse = useCallback(async (isPopState = false) => {
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
    
    revokeUrl();
    setCourse(null);
    setCurrentLesson(null);
    setVideoUrl(null);
    setSubtitleTracks([]);
    dirHandleRef.current = null;
    
    if (!isPopState) {
      if (window.history.state?.isCourseOpen) {
        window.history.back();
      } else {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [course, progress, revokeUrl]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state?.isCourseOpen && course) {
        closeCourse(true);
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && course) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
        closeCourse();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [course, closeCourse]);

  // Get all lessons flat
  const getAllLessons = useCallback((): Lesson[] => {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons);
  }, [course]);

  // Load a video file, subtitles, and create object URLs
  const loadVideo = useCallback(
    async (lesson: Lesson): Promise<string> => {
      revokeUrl();
      const file = await lesson.fileHandle.getFile();
      const url = URL.createObjectURL(file);
      currentUrlRef.current = url;
      
      // Load subtitles if present
      if (lesson.subtitles && lesson.subtitles.length > 0) {
        try {
          const tracks = await Promise.all(
            lesson.subtitles.map(async (sub) => {
              const src = await loadSubtitle(sub.fileHandle, sub.format);
              
              // Map simple languages to labels, fallback to uppercase
              const labels: Record<string, string> = {
                en: 'English',
                es: 'Spanish',
                fr: 'French',
                de: 'German',
                it: 'Italian',
                pt: 'Portuguese',
                ru: 'Russian',
                zh: 'Chinese',
                ja: 'Japanese',
                ko: 'Korean',
                ar: 'Arabic',
                hi: 'Hindi',
              };
              
              const label = labels[sub.language] || sub.language.toUpperCase();
              
              return {
                src,
                language: sub.language,
                label: label === 'UNKNOWN' ? 'Default' : label,
              };
            })
          );
          setSubtitleTracks(tracks);
        } catch (e) {
          console.error('Failed to load subtitles', e);
        }
      }
      
      return url;
    },
    [revokeUrl]
  );

  /**
   * Shared logic: once we have a dirHandle and a parsed course,
   * set up state, load progress, resume last lesson, and persist to IndexedDB.
   */
  const initializeCourse = useCallback(
    async (dirHandle: FileSystemDirectoryHandle, parsedCourse: Course) => {
      dirHandleRef.current = dirHandle;

      // Check for MKV files
      const hasMkv = parsedCourse.modules.some((m) =>
        m.lessons.some((l) => l.fileName.toLowerCase().endsWith('.mkv'))
      );
      setHasMkvFiles(hasMkv);

      setCourse(parsedCourse);

      // Load progress
      let courseProgress = loadProgress(parsedCourse.name);
      if (!courseProgress) {
        courseProgress = createEmptyProgress(parsedCourse.name);
        saveProgress(courseProgress);
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
        setVideoUrl(url);
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
      await saveCourseCache(dirHandle.name, parsedCourse);

      const urlParam = `?course=${encodeURIComponent(dirHandle.name)}`;
      if (!window.history.state?.isCourseOpen) {
        window.history.pushState({ isCourseOpen: true }, '', urlParam);
      } else {
        window.history.replaceState({ isCourseOpen: true }, '', urlParam);
      }
    },
    [loadVideo]
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
          'No video files found in the selected folder. Make sure your course folder contains .mp4, .mkv, .webm, or .mov files.'
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
      try {
        const url = await loadVideo(lesson);
        setVideoUrl(url);
        setCurrentLesson(lesson);
        setProgress((prev) => {
          const updated = updateLessonProgress(prev, lesson.id, {});
          return updated;
        });
      } catch (e) {
        console.error('Error loading lesson:', e);
        setError(`Failed to load video: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    },
    [loadVideo]
  );

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
    setProgress((prev) => {
      return updateLessonProgress(prev, currentLesson.id, {
        completed: true,
        lastPosition: 0,
      });
    });

    // Auto-play next if enabled
    if (autoplay) {
      const allLessons = getAllLessons();
      const currentIdx = allLessons.findIndex(
        (l) => l.id === currentLesson.id
      );
      if (currentIdx < allLessons.length - 1) {
        selectLesson(allLessons[currentIdx + 1]);
      }
    }
  }, [currentLesson, autoplay, getAllLessons, selectLesson]);

  // Toggle autoplay
  const toggleAutoplay = useCallback(() => {
    setAutoplay((prev) => !prev);
  }, []);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Mark lesson complete/incomplete
  const markComplete = useCallback((lessonId: string) => {
    setProgress((prev) => {
      const updated = toggleLessonComplete(prev, lessonId);
      // Update recent course metadata in background
      if (course && dirHandleRef.current) {
        const allLessons = course.modules.flatMap((m) => m.lessons);
        const completedCount = allLessons.filter(
          (l) => updated.lessons[l.id]?.completed
        ).length;
        updateRecentCourseMetadata(dirHandleRef.current.name, {
          completedLessons: completedCount,
          percentage:
            course.totalLessons > 0
              ? Math.round((completedCount / course.totalLessons) * 100)
              : 0,
        });
      }
      return updated;
    });
  }, [course]);

  // Update playback position (debounced save)
  const updatePosition = useCallback(
    (position: number) => {
      if (!currentLesson) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(() => {
        setProgress((prev) => {
          return updateLessonProgress(prev, currentLesson.id, {
            lastPosition: position,
          });
        });
      }, 2000); // Save every 2 seconds at most
    },
    [currentLesson]
  );

  // Get module completion stats
  const getModuleStats = useCallback(
    (moduleId: string) => {
      if (!course) return { completed: 0, total: 0, percentage: 0 };
      const mod = course.modules.find((m) => m.id === moduleId);
      if (!mod) return { completed: 0, total: 0, percentage: 0 };
      return getCompletionStats(
        progress,
        mod.lessons.map((l) => l.id)
      );
    },
    [course, progress]
  );

  // Get overall completion stats
  const getOverallStats = useCallback(() => {
    if (!course) return { completed: 0, total: 0, percentage: 0 };
    const allIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    return getCompletionStats(progress, allIds);
  }, [course, progress]);

  const grantPermission = useCallback(async () => {
    if (!dirHandleRef.current || !course) return;
    try {
      const status = await dirHandleRef.current.requestPermission({ mode: 'read' });
      if (status === 'granted') {
        setRequiresPermission(false);
        if (currentLesson) {
          const url = await loadVideo(currentLesson);
          setVideoUrl(url);
        }
      }
    } catch (e) {
      console.warn('Failed to grant permission', e);
    }
  }, [course, currentLesson, loadVideo]);

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
      
      const hasMkv = courseCache.modules.some((m) =>
        m.lessons.some((l) => l.fileName.toLowerCase().endsWith('.mkv'))
      );
      setHasMkvFiles(hasMkv);
      setCourse(courseCache);

      let courseProgress = loadProgress(courseCache.name);
      if (!courseProgress) {
        courseProgress = createEmptyProgress(courseCache.name);
      }
      setProgress(courseProgress);

      const allLessons = courseCache.modules.flatMap((m) => m.lessons);
      let resumeLesson = allLessons.find((l) => l.id === courseProgress!.lastLessonId) || allLessons[0];
      
      setCurrentLesson(resumeLesson);
      setRequiresPermission(true);
      setIsLoading(false);
    }

    loadFromCache();

    return () => { isCancelled = true; };
  }, [initializeCourse]);

  return (
    <CourseContext.Provider
      value={{
        course,
        currentLesson,
        videoUrl,
        subtitleTracks,
        progress,
        autoplay,
        sidebarOpen,
        isLoading,
        error,
        hasMkvFiles,
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
        getModuleStats,
        getOverallStats,
        closeCourse,
        grantPermission,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}
