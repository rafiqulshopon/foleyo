import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline } from '@/app/lib/markdown';

describe('parseMarkdown', () => {
  it('parses headings, paragraphs, lists, blockquotes, code blocks, and hrs', () => {
    const md = [
      '# Title',
      '',
      'A paragraph with **bold**, *italic*, and `code`.',
      '',
      '> A quote',
      '',
      '- item one',
      '- item two',
      '',
      '1. first',
      '2. second',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '---',
    ].join('\n');

    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'blockquote',
      'list',
      'list',
      'code',
      'hr',
    ]);
    expect(blocks[0]).toEqual({
      type: 'heading',
      level: 1,
      children: [{ type: 'text', text: 'Title' }],
    });
    expect(blocks[5]).toEqual({
      type: 'code',
      language: 'ts',
      content: 'const x = 1;',
    });
  });

  it('allows safe https links and rejects javascript: URLs', () => {
    const safe = parseInline('Read [docs](https://example.com)');
    expect(safe).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', text: 'docs', href: 'https://example.com' },
    ]);

    const unsafe = parseInline('Bad [click](javascript:alert(1))');
    expect(unsafe.some((t) => t.type === 'link')).toBe(false);
  });
});
