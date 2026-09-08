import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useNotes, useCourseNotes } from '@/app/lib/use-notes';

const KEY = 'foleyo_notes_Course';

function stored(): Record<string, string> {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNotes', () => {
  it('starts with an empty note for a fresh lesson', () => {
    const { result } = renderHook(() => useNotes('Course', 'l1'));
    expect(result.current.note).toBe('');
    expect(result.current.isSaved).toBe(false);
  });

  it('loads the existing note for the lesson', () => {
    localStorage.setItem(KEY, JSON.stringify({ l1: 'Old text' }));
    const { result } = renderHook(() => useNotes('Course', 'l1'));
    expect(result.current.note).toBe('Old text');
  });

  it('debounces saves until 1s after the last keystroke', () => {
    const { result } = renderHook(() => useNotes('Course', 'l1'));

    act(() => result.current.updateNote('Hel'));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.updateNote('Hello'));
    act(() => vi.advanceTimersByTime(999));
    expect(stored()).toEqual({}); // timer restarted, nothing saved yet

    act(() => vi.advanceTimersByTime(1));
    expect(stored()).toEqual({ l1: 'Hello' });
  });

  it('shows the Saved flag after the debounced save and hides it 2s later', () => {
    const { result } = renderHook(() => useNotes('Course', 'l1'));

    act(() => result.current.updateNote('Note'));
    expect(result.current.isSaved).toBe(false);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isSaved).toBe(true);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.isSaved).toBe(false);
  });

  it('flushes pending changes on unmount', () => {
    const { result, unmount } = renderHook(() => useNotes('Course', 'l1'));
    act(() => result.current.updateNote('Draft'));
    expect(stored()).toEqual({});

    unmount();
    expect(stored()).toEqual({ l1: 'Draft' });
  });

  it('flushes the old lesson note when the lesson changes', () => {
    const { result, rerender } = renderHook(
      ({ lesson }) => useNotes('Course', lesson),
      { initialProps: { lesson: 'l1' } }
    );

    act(() => result.current.updateNote('One'));
    rerender({ lesson: 'l2' });
    expect(stored()).toEqual({ l1: 'One' });

    act(() => result.current.updateNote('Two'));
    act(() => vi.advanceTimersByTime(1000));
    expect(stored()).toEqual({ l1: 'One', l2: 'Two' });
  });

  it('deletes the stored note when the text becomes empty', () => {
    localStorage.setItem(KEY, JSON.stringify({ l1: 'Keep' }));
    const { result } = renderHook(() => useNotes('Course', 'l1'));

    act(() => result.current.updateNote(''));
    act(() => vi.advanceTimersByTime(1000));
    expect(stored()).toEqual({});
  });

  it('dispatches the foleyo_notes_updated event on save', () => {
    let fired = 0;
    const listener = () => fired++;
    window.addEventListener('foleyo_notes_updated', listener);

    const { result } = renderHook(() => useNotes('Course', 'l1'));
    act(() => result.current.updateNote('Broadcast'));
    act(() => vi.advanceTimersByTime(1000));

    expect(fired).toBe(1);
    window.removeEventListener('foleyo_notes_updated', listener);
  });
});

describe('useCourseNotes', () => {
  it('loads all notes for the course and reacts to updates', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 'x' }));
    const { result } = renderHook(() => useCourseNotes('Course'));
    expect(result.current).toEqual({ a: 'x' });

    localStorage.setItem(KEY, JSON.stringify({ a: 'x', b: 'y' }));
    act(() => {
      window.dispatchEvent(new Event('foleyo_notes_updated'));
    });
    expect(result.current).toEqual({ a: 'x', b: 'y' });
  });

  it('returns empty when there is no course', () => {
    const { result } = renderHook(() => useCourseNotes(undefined));
    expect(result.current).toEqual({});
  });
});
