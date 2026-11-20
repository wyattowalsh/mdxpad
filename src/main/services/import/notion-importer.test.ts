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

  it('keeps the note inside a synced block', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/source1/')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 'shared-1',
                type: 'paragraph',
                paragraph: { rich_text: [{ plain_text: 'Shared note', annotations: {} }] },
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
                id: 'copy-1',
                type: 'synced_block',
                has_children: false,
                synced_block: { synced_from: { type: 'block_id', block_id: 'source1' } },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('Shared note');
    expect(result.warnings).not.toContain('Unsupported block type: synced_block');
  });

  it('keeps the title of a linked page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                type: 'link_to_page',
                link_to_page: { type: 'page_id', page_id: 'linked-page' },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/pages/linkedpage')) {
        return new Response(
          JSON.stringify({
            properties: {
              Topic: { type: 'title', title: [{ plain_text: 'Meeting notes', annotations: {} }] },
            },
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('Meeting notes');
    expect(result.warnings).not.toContain('Unsupported block type: link_to_page');
  });

  it('keeps the title of a mentioned page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url instanceof Request ? url.url : url.toString();
      if (urlStr.includes('/blocks/')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      plain_text: '',
                      mention: { page: { id: 'mentioned-page' } },
                      annotations: {},
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/pages/mentionedpage')) {
        return new Response(
          JSON.stringify({
            properties: {
              Topic: { type: 'title', title: [{ plain_text: 'Meeting notes', annotations: {} }] },
            },
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('Meeting notes');
  });

  it('keeps a mentioned link, emoji, and template date', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                plain_text: '',
                href: 'https://example.com/guide',
                mention: {
                  link_mention: { href: 'https://example.com/guide', title: 'The guide' },
                },
                annotations: {},
              },
              { plain_text: ' ', annotations: {} },
              {
                plain_text: '',
                mention: { custom_emoji: { name: 'bufo' } },
                annotations: {},
              },
              { plain_text: ' ', annotations: {} },
              {
                plain_text: '',
                mention: { template_mention: { template_mention_date: 'today' } },
                annotations: {},
              },
              {
                plain_text: '',
                mention: { link_mention: { href: 'file:///etc/passwd', title: '' } },
                annotations: {},
              },
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
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('[The guide](https://example.com/guide)');
    expect(result.content).toContain('bufo');
    expect(result.content).toContain('today');
    expect(result.content).not.toContain('file:');
  });

  it('keeps both days of a mentioned date', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                plain_text: '',
                mention: { date: { start: '2020-01-02', end: '2020-01-05' } },
                annotations: {},
              },
              { plain_text: ' with ', annotations: {} },
              {
                plain_text: '',
                mention: { user: { name: 'Ada Lovelace' } },
                annotations: {},
              },
              { plain_text: '', href: 'file:///etc/passwd', annotations: {} },
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
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('2020-01-02 to 2020-01-05');
    expect(result.content).toContain('Ada Lovelace');
    expect(result.content).not.toContain('file:');
  });

  it('keeps an inline formula and a mentioned date', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: '', equation: { expression: 'E=mc^2' }, annotations: {} },
              { plain_text: ' on ', annotations: {} },
              {
                plain_text: '',
                mention: { date: { start: '2020-01-02' } },
                annotations: {},
              },
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
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('E=mc^2');
    expect(result.content).toContain('2020-01-02');
  });

  it('keeps the caption on a code block', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'code',
          code: {
            rich_text: [{ plain_text: 'const x = 1;', annotations: {} }],
            caption: [{ plain_text: 'The setup', annotations: {} }],
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
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('```typescript');
    expect(result.content).toContain('const x = 1;');
    expect(result.content).toContain('The setup');
  });

  it('keeps the emoji on a callout', async () => {
    const mockBlocks = {
      results: [
        {
          type: 'callout',
          callout: {
            rich_text: [{ plain_text: 'Watch the ice', annotations: {} }],
            icon: { type: 'emoji', emoji: '💡' },
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
    const result = await importFromNotion('page-id', 'ntn_test_key');
    expect(result.content).toContain('> 💡 Watch the ice');
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
