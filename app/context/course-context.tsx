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

interface CourseContextType {
  // State
  course: Course | null;
  currentLesson: Lesson | null;
  videoUrl: string | null;
  progress: CourseProgress;
  autoplay: boolean;
  sidebarOpen: boolean;
  isLoading: boolean;
  error: string | null;
  hasMkvFiles: boolean;

  // Actions
  openFolder: () => Promise<void>;
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
  const [progress, setProgress] = useState<CourseProgress>(
    createEmptyProgress('')
  );
  const [autoplay, setAutoplay] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMkvFiles, setHasMkvFiles] = useState(false);

  const currentUrlRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup object URL on unmount or URL change
  const revokeUrl = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      revokeUrl();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [revokeUrl]);

  // Get all lessons flat
  const getAllLessons = useCallback((): Lesson[] => {
    if (!course) return [];
    return course.modules.flatMap((m) => m.lessons);
  }, [course]);

  // Load a video file and create object URL
  const loadVideo = useCallback(
    async (lesson: Lesson): Promise<string> => {
      revokeUrl();
      const file = await lesson.fileHandle.getFile();
      const url = URL.createObjectURL(file);
      currentUrlRef.current = url;
      return url;
    },
    [revokeUrl]
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
  }, [loadVideo]);

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
    setProgress((prev) => toggleLessonComplete(prev, lessonId));
  }, []);

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

  return (
    <CourseContext.Provider
      value={{
        course,
        currentLesson,
        videoUrl,
        progress,
        autoplay,
        sidebarOpen,
        isLoading,
        error,
        hasMkvFiles,
        openFolder,
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
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}
