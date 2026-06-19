import { get, set, del } from 'idb-keyval';
import type { Lesson } from '@/app/types';

/**
 * Generates a single thumbnail for a course using the first lesson's video.
 * Uses an offscreen video and canvas element to capture a frame.
 */
export async function generateCourseThumbnail(courseId: string, firstLesson: Lesson): Promise<string | null> {
  const thumbKey = `foleyo_thumb_${courseId}`;
  
  // Check cache first
  try {
    const cached = await get(thumbKey);
    if (cached && cached !== 'generating') return cached as string;
  } catch (e) {
    console.warn('Failed to read thumbnail cache', e);
  }

  // Set to 'generating' so UI knows to shimmer
  await set(thumbKey, 'generating').catch(console.warn);
  
  // Dispatch event to UI that generation started
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('foleyo-thumbnail-generating', { detail: { courseId } }));
  }

  return new Promise(async (resolve) => {
    try {
      const file = await firstLesson.fileHandle.getFile();
      const url = URL.createObjectURL(file);
      
      const video = document.createElement('video');
      video.style.display = 'none';
      video.muted = true;
      video.playsInline = true;
      video.src = url;

      const finish = async (result: string | null) => {
        if (result) {
          await set(thumbKey, result).catch(console.warn);
        } else {
          await del(thumbKey).catch(console.warn);
        }
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('foleyo-thumbnail-ready', { detail: { courseId, thumbnail: result } }));
        }
        resolve(result);
      };

      // Handle errors
      video.onerror = () => {
        cleanup();
        finish(null);
      };

      // Helper to clean up memory
      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
        video.remove();
      };

      video.onloadedmetadata = () => {
        // Seek to 5 seconds, or 10% of duration if shorter than 50 seconds
        const seekTime = video.duration < 50 ? video.duration * 0.1 : 5;
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/webp', 0.7);
            cleanup();
            finish(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Failed to draw thumbnail to canvas', e);
        }
        
        cleanup();
        finish(null);
      };

    } catch (e) {
      console.warn('Failed to generate thumbnail', e);
      // Clean up 'generating' state on error
      await del(thumbKey).catch(console.warn);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('foleyo-thumbnail-ready', { detail: { courseId, thumbnail: null } }));
      }
      resolve(null);
    }
  });
}

/**
 * Retrieves the cached thumbnail for a course from IndexedDB.
 */
export async function getCourseThumbnail(courseId: string): Promise<string | null | 'generating'> {
  try {
    const cached = await get(`foleyo_thumb_${courseId}`);
    return cached ? (cached as string) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Deletes the cached thumbnail when a course is removed.
 */
export async function deleteCourseThumbnail(courseId: string): Promise<void> {
  try {
    await del(`foleyo_thumb_${courseId}`);
  } catch (e) {
    console.warn('Failed to delete thumbnail cache', e);
  }
}
