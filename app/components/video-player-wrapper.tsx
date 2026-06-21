'use client';

import dynamic from 'next/dynamic';

const VideoPlayer = dynamic(
  () => import('./video-player').then((mod) => ({ default: mod.VideoPlayer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-foreground-subtle text-sm">Loading player...</p>
        </div>
      </div>
    ),
  }
);

export { VideoPlayer };
