"use client";

import { useEffect, useRef } from "react";
import {
  removeBookmark,
  updateBookmarkText,
  type Bookmark,
} from "@/app/lib/bookmarks";
import { formatTimestamp } from "@/app/lib/time";
import { FOCUS_RING } from "@/app/components/focus-ring";

export interface BookmarkFocusRequest {
  id: string;
  /** Changes on every request so re-bookmarking the same second refocuses. */
  nonce: number;
}

/**
 * Timestamped notes for the current lesson. Each row jumps the video to its
 * moment; the text is editable in place. Enter/Escape in a row hands focus
 * back to the player (and resumes playback if `N` paused it).
 */
export function BookmarksPanel({
  courseId,
  lessonId,
  bookmarks,
  activeId,
  focusRequest,
  onSeek,
  onAdd,
  onDoneEditing,
}: {
  courseId: string;
  lessonId: string;
  bookmarks: Bookmark[];
  activeId: string | null;
  focusRequest: BookmarkFocusRequest | null;
  onSeek: (time: number) => void;
  onAdd: () => void;
  onDoneEditing: () => void;
}) {
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const lastFocusedNonceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusRequest || lastFocusedNonceRef.current === focusRequest.nonce) {
      return;
    }
    const input = inputRefs.current.get(focusRequest.id);
    if (!input) return;
    lastFocusedNonceRef.current = focusRequest.nonce;
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: "nearest", behavior: "smooth" });
    input.select();
  }, [focusRequest, bookmarks]);

  return (
    <div className="mt-6 bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-hover/50">
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
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="font-medium text-foreground">Bookmarks</h3>
          {bookmarks.length > 0 && (
            <span className="text-xs text-foreground-subtle font-mono">
              {bookmarks.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors ${FOCUS_RING}`}
          title="Bookmark the current moment (N)"
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
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
          <kbd className="ml-1 font-mono text-[10px] opacity-70">N</kbd>
        </button>
      </div>

      {bookmarks.length === 0 ? (
        <p className="px-5 py-4 text-sm text-foreground-subtle">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded border border-border font-mono text-xs">
            N
          </kbd>{" "}
          while watching to save a note at the current second. Click it later to
          jump back.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {bookmarks.map((bookmark) => (
            <li
              key={bookmark.id}
              className={`flex items-center gap-3 px-3 py-1.5 transition-colors ${
                bookmark.id === activeId ? "bg-accent/5" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSeek(bookmark.time)}
                className={`shrink-0 min-w-16 px-2 py-1 rounded-md font-mono text-xs text-accent hover:bg-accent/10 transition-colors text-left ${FOCUS_RING}`}
                aria-label={`Jump to ${formatTimestamp(bookmark.time)}`}
                title="Jump to this moment"
              >
                {formatTimestamp(bookmark.time)}
              </button>
              <input
                ref={(el) => {
                  if (el) inputRefs.current.set(bookmark.id, el);
                  else inputRefs.current.delete(bookmark.id);
                }}
                type="text"
                defaultValue={bookmark.text}
                onChange={(e) =>
                  updateBookmarkText(courseId, lessonId, bookmark.id, e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    e.preventDefault();
                    onDoneEditing();
                  }
                }}
                aria-label={`Note at ${formatTimestamp(bookmark.time)}`}
                placeholder="Add a note… (Enter to resume)"
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground py-1.5 focus:outline-none placeholder:text-foreground-muted/50"
              />
              <button
                type="button"
                onClick={() => removeBookmark(courseId, lessonId, bookmark.id)}
                className={`shrink-0 p-1.5 rounded-md text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING}`}
                aria-label={`Delete bookmark at ${formatTimestamp(bookmark.time)}`}
                title="Delete bookmark"
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
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
