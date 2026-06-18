import { useState, useEffect, useCallback, useRef } from 'react';

export function useNotes(courseId: string | undefined, lessonId: string | undefined) {
  const [note, setNote] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contextRef = useRef({ courseId, lessonId, note, hasUnsavedChanges: false });

  // Keep refs up to date for the unmount flush
  useEffect(() => {
    contextRef.current = { courseId, lessonId, note, hasUnsavedChanges: contextRef.current.hasUnsavedChanges };
  }, [courseId, lessonId, note]);

  const saveNoteImmediate = useCallback((cId: string, lId: string, text: string) => {
    if (!cId || !lId) return;
    const storageKey = `foleyo_notes_${cId}`;
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

  // Load note when lesson changes
  useEffect(() => {
    setIsSaved(false);
    if (!courseId || !lessonId) {
      setNote('');
      return;
    }
    
    const storageKey = `foleyo_notes_${courseId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const notesObj = JSON.parse(stored);
        setNote(notesObj[lessonId] || '');
      } else {
        setNote('');
      }
    } catch (e) {
      setNote('');
    }
  }, [courseId, lessonId]);

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

export function useCourseNotes(courseId: string | undefined) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadNotes = useCallback(() => {
    if (!courseId || typeof window === 'undefined') {
      setNotes({});
      return;
    }
    const storageKey = `foleyo_notes_${courseId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      setNotes(stored ? JSON.parse(stored) : {});
    } catch (e) {
      setNotes({});
    }
  }, [courseId]);

  useEffect(() => {
    loadNotes();
    window.addEventListener('foleyo_notes_updated', loadNotes);
    return () => window.removeEventListener('foleyo_notes_updated', loadNotes);
  }, [loadNotes]);

  return notes;
}
