'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { CourseResource } from '@/app/types';
import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownInline,
} from '@/app/lib/markdown';
import { downloadFileHandle, openFileInNewTab } from '@/app/lib/open-resource';
import { FOCUS_RING } from '@/app/components/focus-ring';

const IGNORED_EXPLORER_DIRS = new Set([
  'node_modules',
  '.git',
  '__pycache__',
  '.next',
  'dist',
  'build',
]);

const TEXT_PREVIEW_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.env',
  '.gitignore',
  '.csv',
  '.svg',
]);

const IMAGE_PREVIEW_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
]);

function getExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

function renderInline(nodes: MarkdownInline[]): React.ReactNode {
  return nodes.map((node, idx) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={idx}>{node.text}</Fragment>;
      case 'code':
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-surface-hover font-mono text-[0.85em] text-accent"
          >
            {node.text}
          </code>
        );
      case 'strong':
        return (
          <strong key={idx} className="font-semibold text-foreground">
            {renderInline(node.children)}
          </strong>
        );
      case 'em':
        return (
          <em key={idx} className="italic">
            {renderInline(node.children)}
          </em>
        );
      case 'link':
        return (
          <a
            key={idx}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            {node.text}
          </a>
        );
    }
  });
}

function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  const renderBlock = (block: MarkdownBlock, idx: number) => {
    switch (block.type) {
      case 'heading': {
        const sizeClass: Record<number, string> = {
          1: 'text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border',
          2: 'text-xl font-semibold mt-6 mb-2.5',
          3: 'text-lg font-semibold mt-5 mb-2',
          4: 'text-base font-semibold mt-4 mb-1.5',
          5: 'text-sm font-semibold mt-3 mb-1',
          6: 'text-xs font-semibold uppercase tracking-wider mt-3 mb-1 text-foreground-muted',
        };
        const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        return (
          <Tag key={idx} className={`${sizeClass[block.level]} text-foreground first:mt-0`}>
            {renderInline(block.children)}
          </Tag>
        );
      }
      case 'paragraph':
        return (
          <p key={idx} className="my-3 text-sm leading-7 text-foreground/90">
            {renderInline(block.children)}
          </p>
        );
      case 'code':
        return (
          <pre
            key={idx}
            className="my-4 p-4 rounded-xl bg-background border border-border overflow-x-auto text-xs font-mono leading-relaxed text-foreground"
          >
            <code>{block.content}</code>
          </pre>
        );
      case 'blockquote':
        return (
          <blockquote
            key={idx}
            className="my-4 pl-4 py-1 border-l-2 border-accent bg-accent/5 rounded-r-lg text-sm text-foreground-muted"
          >
            {renderInline(block.children)}
          </blockquote>
        );
      case 'list': {
        const ListTag = block.ordered ? 'ol' : 'ul';
        return (
          <ListTag
            key={idx}
            className={`my-3 pl-6 space-y-1.5 text-sm leading-7 text-foreground/90 ${
              block.ordered ? 'list-decimal' : 'list-disc'
            }`}
          >
            {block.items.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInline(item)}</li>
            ))}
          </ListTag>
        );
      }
      case 'hr':
        return <hr key={idx} className="my-6 border-border" />;
    }
  };

  return <div className="p-6 sm:p-8">{blocks.map(renderBlock)}</div>;
}

interface FolderNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  fileHandle?: FileSystemFileHandle;
  dirHandle?: FileSystemDirectoryHandle;
}

async function listDirEntries(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string = ''
): Promise<FolderNode[]> {
  const dirs: FolderNode[] = [];
  const files: FolderNode[] = [];

  for await (const entry of dirHandle.values()) {
    if (entry.name.startsWith('.')) continue;
    if (entry.kind === 'directory') {
      if (IGNORED_EXPLORER_DIRS.has(entry.name.toLowerCase())) continue;
      dirs.push({
        name: entry.name,
        path: prefix ? `${prefix}/${entry.name}` : entry.name,
        kind: 'directory',
        dirHandle: entry,
      });
    } else {
      files.push({
        name: entry.name,
        path: prefix ? `${prefix}/${entry.name}` : entry.name,
        kind: 'file',
        fileHandle: entry,
      });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return [...dirs, ...files];
}

function FolderTreeBranch({
  nodes,
  depth,
  selectedPath,
  onSelectFile,
}: {
  nodes: FolderNode[];
  depth: number;
  selectedPath: string | null;
  onSelectFile: (node: FolderNode) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, FolderNode[]>>({});

  const toggleDir = async (node: FolderNode) => {
    if (!node.dirHandle) return;
    if (expanded[node.path]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[node.path];
        return next;
      });
      return;
    }
    const children = await listDirEntries(node.dirHandle, node.path);
    setExpanded((prev) => ({ ...prev, [node.path]: children }));
  };

  return (
    <div>
      {nodes.map((node) => {
        const isDir = node.kind === 'directory';
        const isOpen = Boolean(expanded[node.path]);
        const isSelected = selectedPath === node.path;

        return (
          <div key={node.path}>
            <button
              onClick={() => (isDir ? toggleDir(node) : onSelectFile(node))}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className={`w-full flex items-center gap-1.5 pr-2 py-1.5 rounded-lg text-left text-xs transition-colors ${FOCUS_RING} ${
                isSelected
                  ? 'bg-accent/15 text-foreground font-medium'
                  : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              {isDir ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {isDir && isOpen && (
              <FolderTreeBranch
                nodes={expanded[node.path]}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CodeFolderExplorer({
  dirHandle,
}: {
  dirHandle: FileSystemDirectoryHandle;
}) {
  const [rootNodes, setRootNodes] = useState<FolderNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FolderNode | null>(null);
  const [preview, setPreview] = useState<
    | { kind: 'text'; text: string }
    | { kind: 'image'; url: string }
    | { kind: 'binary'; size: number }
    | null
  >(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDirEntries(dirHandle).then((entries) => {
      if (!cancelled) setRootNodes(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [dirHandle]);

  useEffect(() => {
    if (!selectedFile?.fileHandle) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    selectedFile.fileHandle.getFile().then(async (file) => {
      if (cancelled) return;
      const ext = getExt(file.name);
      if (IMAGE_PREVIEW_EXTENSIONS.has(ext)) {
        objectUrl = URL.createObjectURL(file);
        setPreview({ kind: 'image', url: objectUrl });
      } else if (
        TEXT_PREVIEW_EXTENSIONS.has(ext) ||
        file.type.startsWith('text/') ||
        file.size < 250_000
      ) {
        const text = await file.text();
        if (!cancelled) setPreview({ kind: 'text', text });
      } else {
        setPreview({ kind: 'binary', size: file.size });
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const handleCopy = useCallback(() => {
    if (preview?.kind !== 'text') return;
    navigator.clipboard?.writeText(preview.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [preview]);

  return (
    <div className="flex flex-1 min-h-0 border border-border rounded-xl overflow-hidden bg-surface">
      {/* File tree */}
      <div className="w-60 shrink-0 border-r border-border overflow-y-auto p-2 bg-background/40">
        {rootNodes.length === 0 ? (
          <p className="text-xs text-foreground-subtle p-3">Empty folder</p>
        ) : (
          <FolderTreeBranch
            nodes={rootNodes}
            depth={0}
            selectedPath={selectedFile?.path ?? null}
            onSelectFile={(node) => {
              setPreview(null);
              setSelectedFile(node);
            }}
          />
        )}
      </div>

      {/* Preview pane */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedFile ? (
          <div className="flex-1 flex items-center justify-center text-sm text-foreground-subtle p-6">
            Select a file from the folder to inspect its contents
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-hover/40 shrink-0">
              <span className="text-xs font-mono text-foreground truncate">
                {selectedFile.path}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {preview?.kind === 'text' && (
                  <button
                    onClick={handleCopy}
                    className={`px-2.5 py-1 rounded-md text-xs bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
                {selectedFile.fileHandle && (
                  <button
                    onClick={() => downloadFileHandle(selectedFile.fileHandle!)}
                    className={`px-2.5 py-1 rounded-md text-xs bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {preview?.kind === 'text' && (
                <pre className="text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {preview.text}
                </pre>
              )}
              {preview?.kind === 'image' && (
                <div className="flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.url}
                    alt={selectedFile.name}
                    className="max-w-full max-h-[60vh] rounded-lg border border-border"
                  />
                </div>
              )}
              {preview?.kind === 'binary' && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <p className="text-sm text-foreground-muted">
                    Binary file ({Math.round(preview.size / 1024)} KB)
                  </p>
                  {selectedFile.fileHandle && (
                    <button
                      onClick={() => downloadFileHandle(selectedFile.fileHandle!)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors ${FOCUS_RING}`}
                    >
                      Download file
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const KIND_LABELS: Record<CourseResource['kind'], string> = {
  pdf: 'PDF',
  markdown: 'Markdown',
  text: 'Text',
  folder: 'Code Folder',
  archive: 'Archive',
  other: 'File',
};

export function ResourceViewer({
  resource,
  onClose,
}: {
  resource: CourseResource;
  onClose: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (resource.kind === 'pdf' && resource.fileHandle) {
      resource.fileHandle
        .getFile()
        .then((file) => {
          if (cancelled) return;
          const blob =
            file.type === 'application/pdf'
              ? file
              : new Blob([file], { type: 'application/pdf' });
          createdUrl = URL.createObjectURL(blob);
          setPdfUrl(createdUrl);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load PDF');
          }
        });
    } else if (
      (resource.kind === 'markdown' || resource.kind === 'text') &&
      resource.fileHandle
    ) {
      resource.fileHandle
        .getFile()
        .then((file) => file.text())
        .then((text) => {
          if (!cancelled) {
            setTextContent(text);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load file');
          }
        });
    }

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setPdfUrl(null);
      setTextContent(null);
    };
  }, [resource]);

  const handleCopy = () => {
    if (!textContent) return;
    navigator.clipboard?.writeText(textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Resource top bar */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-surface/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors shrink-0 ${FOCUS_RING}`}
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to lesson
          </button>

          <span className="shrink-0 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold">
            {KIND_LABELS[resource.kind]}
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {resource.title}
            </h2>
            <p className="text-[11px] text-foreground-subtle font-mono truncate">
              {resource.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {resource.kind === 'markdown' && textContent !== null && (
            <button
              onClick={() => setShowRaw((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
            >
              {showRaw ? 'Rendered' : 'Raw'}
            </button>
          )}

          {(resource.kind === 'markdown' || resource.kind === 'text') &&
            textContent !== null && (
              <button
                onClick={handleCopy}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}

          {resource.kind === 'pdf' && resource.fileHandle && (
            <button
              onClick={() =>
                openFileInNewTab(resource.fileHandle!, 'application/pdf')
              }
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-border text-foreground-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
            >
              Open tab
            </button>
          )}

          {resource.fileHandle && (
            <button
              onClick={() => downloadFileHandle(resource.fileHandle!, resource.name)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium bg-accent/15 hover:bg-accent/25 text-accent transition-colors ${FOCUS_RING}`}
            >
              Download
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-sm text-danger">
            {error}
          </div>
        ) : resource.kind === 'pdf' ? (
          pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={resource.title}
              className="w-full flex-1 rounded-xl border border-border bg-white"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          )
        ) : resource.kind === 'markdown' ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto rounded-xl border border-border bg-surface shadow-sm">
              {textContent === null ? (
                <div className="flex items-center justify-center p-12">
                  <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                </div>
              ) : showRaw ? (
                <pre className="p-6 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {textContent}
                </pre>
              ) : (
                <MarkdownView source={textContent} />
              )}
            </div>
          </div>
        ) : resource.kind === 'text' ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto rounded-xl border border-border bg-surface shadow-sm p-6">
              {textContent === null ? (
                <div className="flex items-center justify-center p-12">
                  <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                </div>
              ) : (
                <pre className="text-xs sm:text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {textContent}
                </pre>
              )}
            </div>
          </div>
        ) : resource.kind === 'folder' && resource.dirHandle ? (
          <CodeFolderExplorer dirHandle={resource.dirHandle} />
        ) : null}
      </div>
    </div>
  );
}
