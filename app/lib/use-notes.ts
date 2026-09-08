import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';

const EMPTY_NOTES: Record<string, string> = {};

function notesKey(courseId: string) {
  return `foleyo_notes_${courseId}`;
}

function readNote(courseId: string, lessonId: string): string {
  try {
    const stored = localStorage.getItem(notesKey(courseId));
    if (!stored) return '';
    const notesObj = JSON.parse(stored) as Record<string, string>;
    return notesObj[lessonId] || '';
  } catch {
    return '';
  }
}

export function useNotes(courseId: string | undefined, lessonId: string | undefined) {
  const [note, setNote] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contextRef = useRef({ courseId, lessonId, note, hasUnsavedChanges: false });

  // Load the note for the active lesson with a render-time adjustment —
  // when the lesson key changes, reset immediately instead of via an effect.
  // (Effect ordering still guarantees the unmount/switch flush below saves
  // the *old* note: it reads contextRef, which is only synced in an effect.)
  const activeKey = courseId && lessonId ? `${courseId}::${lessonId}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (activeKey !== loadedKey) {
    setLoadedKey(activeKey);
    setNote(activeKey && courseId && lessonId ? readNote(courseId, lessonId) : '');
    setIsSaved(false);
  }

  // Keep refs up to date for the unmount flush
  useEffect(() => {
    contextRef.current = { courseId, lessonId, note, hasUnsavedChanges: contextRef.current.hasUnsavedChanges };
  }, [courseId, lessonId, note]);

  const saveNoteImmediate = useCallback((cId: string, lId: string, text: string) => {
    if (!cId || !lId) return;
    const storageKey = notesKey(cId);
    try {
      const stored = localStorage.getItem(storageKey);
      const notesObj = stored ? JSON.parse(stored) : {};

      if (text.trim() === '') {
        delete notesObj[lId];
      } else {
        notesObj[lId] = text;
      }

      localStorage.setItem(storageKey, JSON.stringify(notesObj));
      // Dispatch an event so other components (like sidebar) can react
      window.dispatchEvent(new Event('foleyo_notes_updated'));
    } catch (e) {
      console.error('Failed to save note', e);
    }
  }, []);

  // Flush pending changes when lesson or course changes, or unmounts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const { courseId: prevCId, lessonId: prevLId, note: prevNote, hasUnsavedChanges } = contextRef.current;
      if (hasUnsavedChanges && prevCId && prevLId) {
        saveNoteImmediate(prevCId, prevLId, prevNote);
        contextRef.current.hasUnsavedChanges = false;
      }
    };
  }, [saveNoteImmediate, courseId, lessonId]); // when these change, the cleanup runs for the old ones!

  const updateNote = useCallback((text: string) => {
    setNote(text);
    setIsSaved(false);
    contextRef.current.hasUnsavedChanges = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (!courseId || !lessonId) return;

    saveTimeoutRef.current = setTimeout(() => {
      saveNoteImmediate(courseId, lessonId, text);
      contextRef.current.hasUnsavedChanges = false;
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      saveTimeoutRef.current = null;
    }, 1000);
  }, [courseId, lessonId, saveNoteImmediate]);

  return { note, updateNote, isSaved };
}

const NOTES_EVENT = 'foleyo_notes_updated';

function subscribeToNotes(onChange: () => void) {
  window.addEventListener(NOTES_EVENT, onChange);
  return () => window.removeEventListener(NOTES_EVENT, onChange);
}

// Parsed snapshots are cached per course keyed by the raw storage string, so
// getSnapshot keeps a stable object identity between renders.
const notesCache = new Map<string, { raw: string | null; parsed: Record<string, string> }>();

function readCourseNotesSnapshot(courseId: string): Record<string, string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(notesKey(courseId));
  } catch {
    raw = null;
  }

  const cached = notesCache.get(courseId);
  if (cached && cached.raw === raw) return cached.parsed;

  let parsed = EMPTY_NOTES;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, string>;
    } catch {
      parsed = EMPTY_NOTES;
    }
  }
  notesCache.set(courseId, { raw, parsed });
  return parsed;
}

export function useCourseNotes(courseId: string | undefined) {
  return useSyncExternalStore(
    subscribeToNotes,
    () => (courseId ? readCourseNotesSnapshot(courseId) : EMPTY_NOTES),
    () => EMPTY_NOTES
  );
}
