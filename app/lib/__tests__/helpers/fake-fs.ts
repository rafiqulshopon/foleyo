/**
 * In-memory fakes for the File System Access API,
 * structurally compatible with the ambient interfaces
 * declared in app/types/file-system.d.ts.
 */

export class FakeFileHandle implements FileSystemFileHandle {
  readonly kind = 'file' as const;

  constructor(
    readonly name: string,
    private readonly file: File
  ) {}

  getFile(): Promise<File> {
    return Promise.resolve(this.file);
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return Promise.resolve(other === (this as unknown as FileSystemHandle));
  }

  createWritable(): Promise<never> {
    return Promise.reject(new Error('FakeFileHandle.createWritable is not implemented'));
  }
}

export class FakeDirHandle implements FileSystemDirectoryHandle {
  readonly kind = 'directory' as const;
  private readonly children = new Map<string, FakeFileHandle | FakeDirHandle>();

  constructor(readonly name: string) {}

  addFile(name: string, content = ''): this {
    this.children.set(name, new FakeFileHandle(name, new File([content], name)));
    return this;
  }

  addDir(name: string): FakeDirHandle {
    const dir = new FakeDirHandle(name);
    this.children.set(name, dir);
    return dir;
  }

  async *values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle> {
    for (const child of this.children.values()) {
      yield child;
    }
  }

  async getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle> {
    const child = this.children.get(name);
    if (child instanceof FakeDirHandle) return child;
    throw new DOMException('Directory not found', 'NotFoundError');
  }

  async getFileHandle(name: string): Promise<FileSystemFileHandle> {
    const child = this.children.get(name);
    if (child instanceof FakeFileHandle) return child;
    throw new DOMException('File not found', 'NotFoundError');
  }

  async queryPermission(): Promise<'granted'> {
    return 'granted';
  }

  async requestPermission(): Promise<'granted'> {
    return 'granted';
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return Promise.resolve(other === (this as unknown as FileSystemHandle));
  }

  removeEntry(): Promise<void> {
    return Promise.reject(new Error('FakeDirHandle.removeEntry is not implemented'));
  }

  resolve(): Promise<string[] | null> {
    return Promise.reject(new Error('FakeDirHandle.resolve is not implemented'));
  }
}
