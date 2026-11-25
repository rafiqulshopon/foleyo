'use client';

import { useEffect, useRef, useState } from 'react';
import { useCourse } from '@/app/context/course-context';
import {
  createBackup,
  downloadBackupFile,
  parseBackupJson,
  restoreBackup,
  summarizeBackup,
  type BackupSummary,
  type FoleyoBackup,
} from '@/app/lib/backup';
import { FOCUS_RING } from '@/app/components/focus-ring';

export function BackupModal() {
  const {
    course,
    backupOpen,
    setBackupOpen,
    reloadCourseProgress,
    syncToFolder,
    syncStatus,
    syncMessage,
    isFallbackSession,
  } = useCourse();

  const [pendingBackup, setPendingBackup] = useState<FoleyoBackup | null>(null);
  const [pendingSummary, setPendingSummary] = useState<BackupSummary | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setBackupOpen(false);
    setPendingBackup(null);
    setPendingSummary(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  useEffect(() => {
    if (!backupOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setBackupOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [backupOpen, setBackupOpen]);

  if (!backupOpen) return null;

  const currentSummary = summarizeBackup(createBackup());

  const handleExport = () => {
    const backup = createBackup();
    downloadBackupFile(backup);
    setErrorMessage(null);
    setStatusMessage(
      `Exported ${backup ? Object.keys(backup.data).length : 0} saved entries as JSON.`,
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const parsed = parseBackupJson(text);
      setPendingBackup(parsed);
      setPendingSummary(summarizeBackup(parsed));
    } catch (err) {
      setPendingBackup(null);
      setPendingSummary(null);
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not read backup file.',
      );
    }
  };

  const handleConfirmImport = () => {
    if (!pendingBackup) return;
    const { importedKeys } = restoreBackup(pendingBackup, importMode);
    reloadCourseProgress();
    setPendingBackup(null);
    setPendingSummary(null);
    setErrorMessage(null);
    setStatusMessage(
      `Restored ${importedKeys} saved entries (${importMode === 'merge' ? 'merged' : 'replaced'}).`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Backup, restore, and folder sync"
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xl animate-fade-in space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Backup, Restore &amp; Sync
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Keep your progress, notes, bookmarks, settings, and watch streak safe.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close backup dialog"
            className={`p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors ${FOCUS_RING}`}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Full JSON Backup / Restore */}
        <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Full Browser Backup (.json)
              </h3>
              <p className="text-[11px] text-foreground-subtle mt-0.5">
                {currentSummary.coursesCount} course
                {currentSummary.coursesCount === 1 ? '' : 's'} ·{' '}
                {currentSummary.notesCoursesCount} with notes ·{' '}
                {currentSummary.totalKeys} stored items
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors ${FOCUS_RING}`}
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export JSON backup
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-border text-foreground transition-colors ${FOCUS_RING}`}
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import JSON backup…
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Pending import preview & confirmation */}
          {pendingSummary && (
            <div className="mt-2 rounded-lg border border-accent/30 bg-accent/8 p-3 space-y-2.5">
              <div className="text-xs text-foreground">
                <p className="font-medium">Ready to import backup</p>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  {pendingSummary.coursesCount} course
                  {pendingSummary.coursesCount === 1 ? '' : 's'} ·{' '}
                  {pendingSummary.notesCoursesCount} with notes ·{' '}
                  {pendingSummary.bookmarksCoursesCount} with bookmarks
                  {pendingSummary.hasWatchHistory ? ' · watch history' : ''}
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                  />
                  Merge with existing
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  Replace all local data
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors ${FOCUS_RING}`}
                >
                  Restore now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingBackup(null);
                    setPendingSummary(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-foreground hover:bg-surface transition-colors ${FOCUS_RING}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <p className="text-xs text-success font-medium">{statusMessage}</p>
          )}
          {errorMessage && (
            <p className="text-xs text-danger font-medium">{errorMessage}</p>
          )}
        </div>

        {/* Optional `.foleyo.json` Course Folder Sync */}
        {course && (
          <div className="rounded-xl border border-border bg-background/60 p-4 space-y-2.5">
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Course Folder Sync (<code className="font-mono">.foleyo.json</code>)
              </h3>
              <p className="text-[11px] text-foreground-subtle mt-0.5 leading-relaxed">
                Save progress, notes, bookmarks, and settings for{' '}
                <strong className="text-foreground">{course.name}</strong> right
                inside its folder so they travel with an external drive or cloud
                folder. Loaded automatically when opened.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={syncToFolder}
                disabled={isFallbackSession || syncStatus === 'syncing'}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${FOCUS_RING} ${
                  isFallbackSession
                    ? 'bg-surface/50 border-border/50 text-foreground-subtle cursor-not-allowed'
                    : 'bg-surface hover:bg-surface-hover border-border text-foreground'
                }`}
              >
                {syncStatus === 'syncing'
                  ? 'Writing .foleyo.json…'
                  : 'Write .foleyo.json to folder'}
              </button>

              {isFallbackSession && (
                <span className="text-[11px] text-foreground-subtle">
                  Available in Chrome / Edge (requires folder write permission)
                </span>
              )}
              {syncStatus === 'synced' && syncMessage && (
                <span className="text-xs text-success font-medium">
                  {syncMessage}
                </span>
              )}
              {syncStatus === 'error' && syncMessage && (
                <span className="text-xs text-danger">{syncMessage}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
