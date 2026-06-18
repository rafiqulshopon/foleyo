'use client';

import { CourseProvider, useCourse } from '@/app/context/course-context';
import { Header } from '@/app/components/header';
import { Sidebar } from '@/app/components/sidebar';
import { VideoPlayer } from '@/app/components/video-player';
import { WelcomeScreen } from '@/app/components/welcome-screen';
import { useEffect, useState } from 'react';

function BrowserCheck() {
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported('showDirectoryPicker' in window);
  }, []);

  if (isSupported) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-danger/15 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-danger"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Browser Not Supported
        </h1>
        <p className="text-foreground-muted mb-6 leading-relaxed">
          Foleyo requires the{' '}
          <strong className="text-foreground">File System Access API</strong> to
          load course folders from your computer. This API is currently only
          supported in:
        </p>
        <div className="flex justify-center gap-4 mb-6">
          <div className="px-4 py-3 rounded-xl bg-surface border border-border text-sm">
            <span className="text-lg">🌐</span>
            <p className="font-medium mt-1">Chrome</p>
          </div>
          <div className="px-4 py-3 rounded-xl bg-surface border border-border text-sm">
            <span className="text-lg">🔷</span>
            <p className="font-medium mt-1">Edge</p>
          </div>
        </div>
        <p className="text-xs text-foreground-subtle">
          Please open this page in Chrome or Edge to use Foleyo.
        </p>
      </div>
    </div>
  );
}

function CourseApp() {
  const { course, hasMkvFiles } = useCourse();
  const [mkvDismissed, setMkvDismissed] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <BrowserCheck />
      <Header />

      {/* MKV banner */}
      {hasMkvFiles && !mkvDismissed && course && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-warning">
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
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Some lessons are MKV files. They may not play if they use H.265/HEVC
              codecs. Consider converting to MP4 (H.264) for best compatibility.
            </span>
          </div>
          <button
            onClick={() => setMkvDismissed(true)}
            className="text-warning/70 hover:text-warning transition-colors p-1"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {course ? (
          <>
            <Sidebar />
            <VideoPlayer />
          </>
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <CourseProvider>
      <CourseApp />
    </CourseProvider>
  );
}
