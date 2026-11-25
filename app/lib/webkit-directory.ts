/**
 * Virtual FileSystemDirectoryHandle adapter for `<input type="file" webkitdirectory />`.
 * Enables Firefox, Safari, and any browser without `window.showDirectoryPicker`
 * to open local course folders using the exact same `parseCourseDirectory` pipeline.
 */

class VirtualFileHandle implements FileSystemFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  private readonly file: File;

  constructor(name: string, file: File) {
    this.name = name;
    this.file = file;
  }

  async getFile(): Promise<File> {
    return this.file;
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return other === this;
  }
}

class VirtualDirectoryHandle implements FileSystemDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  readonly entries = new Map<string, VirtualFileHandle | VirtualDirectoryHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async *values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  > {
    for (const entry of this.entries.values()) {
      yield entry;
    }
  }

  async getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle> {
    const entry = this.entries.get(name);
    if (entry && entry.kind === 'directory') return entry;
    throw new DOMException(`Directory not found: ${name}`, 'NotFoundError');
  }

  async getFileHandle(name: string): Promise<FileSystemFileHandle> {
    const entry = this.entries.get(name);
    if (entry && entry.kind === 'file') return entry;
    throw new DOMException(`File not found: ${name}`, 'NotFoundError');
  }

  async removeEntry(): Promise<void> {
    throw new DOMException('Read-only virtual directory', 'NotAllowedError');
  }

  async resolve(): Promise<string[] | null> {
    return null;
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return other === this;
  }

  async queryPermission(): Promise<'granted'> {
    return 'granted';
  }

  async requestPermission(): Promise<'granted'> {
    return 'granted';
  }
}

/**
 * Convert a `FileList` (or array of `File` objects with `webkitRelativePath`)
 * into a root `FileSystemDirectoryHandle` compatible with `parseCourseDirectory`.
 */
export function buildVirtualDirectoryFromFiles(
  files: FileList | File[],
): FileSystemDirectoryHandle | null {
  const list = Array.from(files);
  if (list.length === 0) return null;

  // Determine the shared top-level folder name from webkitRelativePath
  const firstRel = (list[0] as File & { webkitRelativePath?: string })
    .webkitRelativePath;
  const rootName =
    firstRel && firstRel.includes('/')
      ? firstRel.split('/')[0]
      : 'Selected Course';

  const root = new VirtualDirectoryHandle(rootName);

  for (const file of list) {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const rawParts = rel.split('/').filter(Boolean);
    // Strip the leading root folder segment when webkitRelativePath is populated
    const parts =
      rawParts.length > 1 && rawParts[0] === rootName
        ? rawParts.slice(1)
        : rawParts;

    if (parts.length === 0) continue;

    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      let next = cursor.entries.get(dirName);
      if (!next || next.kind !== 'directory') {
        next = new VirtualDirectoryHandle(dirName);
        cursor.entries.set(dirName, next);
      }
      cursor = next;
    }

    const fileName = parts[parts.length - 1];
    cursor.entries.set(fileName, new VirtualFileHandle(fileName, file));
  }

  return root;
}
