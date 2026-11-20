/**
 * Notion importer tests.
 * Tests Notion block conversion and HTTP error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importFromNotion, NotionImportError } from './notion-importer';

describe('notion-importer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should convert paragraph blocks', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Hello world', annotations: {} }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('test-page-id', 'ntn_test_key');
    expect(result.content).toContain('Hello world');
  });

  it('should convert heading blocks', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Title', annotations: {} }],
          },
        },
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ plain_text: 'Subtitle', annotations: {} }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.content).toContain('# Title');
    expect(result.content).toContain('## Subtitle');
  });

  it('should convert code blocks with language', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'code',
          code: {
            rich_text: [{ plain_text: 'const x = 1;', annotations: {} }],
            language: 'typescript',
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.content).toContain('```typescript');
    expect(result.content).toContain('const x = 1;');
  });

  it('should convert list items', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'Item 1', annotations: {} }],
          },
        },
        {
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ plain_text: 'Step 1', annotations: {} }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.content).toContain('- Item 1');
    expect(result.content).toContain('1. Step 1');
  });

  it('should handle rich text annotations', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: 'bold', annotations: { bold: true } },
              { plain_text: ' and ', annotations: {} },
              { plain_text: 'italic', annotations: { italic: true } },
            ],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('_italic_');
  });

  it('should throw UNAUTHORIZED for 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Unauthorized', { status: 401 }))
    );

    try {
      await importFromNotion('page-id', 'bad-key');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(NotionImportError);
      expect((e as NotionImportError).message).toContain('Unauthorized');
    }
  });

  it('should throw NOT_FOUND for 404 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Not Found', { status: 404 }))
    );

    await expect(importFromNotion('bad-id', 'key')).rejects.toThrow(NotionImportError);
  });

  it('keeps an equation, a bookmark, and a file', async () => {
    const mockBlocks = {
      results: [
        { type: 'equation', equation: { expression: 'x^2 + 1' } },
        {
          type: 'bookmark',
          bookmark: {
            url: 'https://example.com/guide',
            rich_text: [{ plain_text: 'Guide', annotations: {} }],
          },
        },
        {
          type: 'file',
          file: {
            external: { url: 'https://example.com/notes.pdf' },
            caption: [{ plain_text: 'Notes', annotations: {} }],
          },
        },
        { type: 'child_page', child_page: { title: 'Nested page' } },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.content).toContain('x^2 + 1');
    expect(result.content).toContain('[Guide](https://example.com/guide)');
    expect(result.content).toContain('[Notes](https://example.com/notes.pdf)');
    expect(result.content).toContain('Nested page');
    expect(result.warnings).not.toContain('Unsupported block type: equation');
  });

  it('keeps the rows of a table and the words inside a toggle', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/table-1/')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 'row-1',
                type: 'table_row',
                table_row: {
                  cells: [[{ plain_text: 'Name' }], [{ plain_text: 'Cost' }]],
                },
              },
              {
                id: 'row-2',
                type: 'table_row',
                table_row: {
                  cells: [[{ plain_text: 'Tea' }], [{ plain_text: '$2' }]],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/blocks/toggle-1/')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 'hidden-1',
                type: 'paragraph',
                paragraph: { rich_text: [{ plain_text: 'Hidden note', annotations: {} }] },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/blocks/')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 'table-1',
                type: 'table',
                has_children: true,
                table: { table_width: 2, has_column_header: true },
              },
              {
                id: 'toggle-1',
                type: 'toggle',
                has_children: true,
                toggle: { rich_text: [{ plain_text: 'More', annotations: {} }] },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.content).toContain('| Name | Cost |');
    expect(result.content).toContain('| Tea | $2 |');
    expect(result.content).toContain('---');
    expect(result.content).toContain('More');
    expect(result.content).toContain('Hidden note');
    expect(result.warnings).not.toContain('Unsupported block type: table');
  });

  it('should warn about unsupported block types', async () => {
    const mockBlocks = {
      results: [{ type: 'unsupported_type', unsupported_type: {} }],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify(mockBlocks), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const result = await importFromNotion('page-id', 'key');
    expect(result.warnings).toContain('Unsupported block type: unsupported_type');
  });

  it('should strip hyphens from page IDs', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    await importFromNotion('abc-def-123', 'key');
    const blockUrl = mockFetch.mock.calls[0]?.[0];
    const urlStr = blockUrl instanceof Request ? blockUrl.url : String(blockUrl);
    expect(urlStr).toContain('abcdef123');
  });
});
