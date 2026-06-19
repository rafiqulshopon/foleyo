/**
 * Convert SRT (SubRip Text) to WebVTT format.
 * WebVTT requires a "WEBVTT" header and uses '.' instead of ',' for milliseconds.
 */
export function convertSrtToVtt(srtContent: string): string {
  let vtt = 'WEBVTT\n\n';
  
  // Replace all ',' with '.' in the timestamp lines
  // SRT timestamp format: 00:00:01,000 --> 00:00:04,000
  // VTT timestamp format: 00:00:01.000 --> 00:00:04.000
  
  const lines = srtContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line is a timestamp line (contains -->)
    if (line.includes('-->')) {
      vtt += line.replace(/,/g, '.') + '\n';
    } else {
      vtt += line + '\n';
    }
  }
  
  return vtt;
}

/**
 * Reads a subtitle file, converts to VTT if necessary, and returns an Object URL.
 */
export async function loadSubtitle(
  handle: FileSystemFileHandle,
  format: 'srt' | 'vtt'
): Promise<string> {
  const file = await handle.getFile();
  let text = await file.text();
  
  if (format === 'srt') {
    text = convertSrtToVtt(text);
  }
  
  const blob = new Blob([text], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}
