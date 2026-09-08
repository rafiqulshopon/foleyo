'use client';

import { useEffect } from 'react';
import { FOCUS_RING } from '@/app/components/focus-ring';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surface the error (with its digest) for debugging
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center animate-fade-in">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-sm leading-relaxed text-foreground-muted mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => unstable_retry()}
          className={`rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
