/**
 * Helpers for opening or downloading local FileSystemFileHandles
 * in the browser/OS when a resource isn't rendered in-app.
 */

export async function downloadFileHandle(
  fileHandle: FileSystemFileHandle,
  fileName?: string
): Promise<void> {
  const file = await fileHandle.getFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openFileInNewTab(
  fileHandle: FileSystemFileHandle,
  mimeType?: string
): Promise<void> {
  const file = await fileHandle.getFile();
  const blob = mimeType && !file.type ? new Blob([file], { type: mimeType }) : file;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Keep URL alive long enough for the new tab to load it
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
