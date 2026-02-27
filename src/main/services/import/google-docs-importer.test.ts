/**
 * Google Docs importer tests.
 * Tests HTML export fetching, URL extraction, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importFromGoogleDocs, GoogleDocsImportError } from './google-docs-importer';
import { convertHtmlToMdx } from './html-to-mdx-converter';

// Mock html-to-mdx-converter
vi.mock('./html-to-mdx-converter', () => ({
  convertHtmlToMdx: vi.fn((html: string) => {
    return Promise.resolve(html.replace(/<[^>]+>/g, '').trim());
  }),
}));

describe('google-docs-importer', () => {
  beforeEach(() => {
    vi.mocked(convertHtmlToMdx).mockImplementation((html: string) =>
      Promise.resolve(html.replace(/<[^>]+>/g, '').trim())
    );
  });

  it('should fetch and convert a Google Doc', async () => {
    const mockHtml = '<html><head><title>My Doc</title></head><body><p>Content</p></body></html>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(mockHtml, { status: 200 }));

    const result = await importFromGoogleDocs('doc-123', 'token');
    expect(result.title).toBe('My Doc');
    expect(result.content).toBeTruthy();
  });

  it('should extract doc ID from full URL', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<html><body>test</body></html>', { status: 200 }));

    await importFromGoogleDocs('https://docs.google.com/document/d/abc123/edit', 'token');

    const callArg = mockFetch.mock.calls[0]?.[0];
    const url = typeof callArg === 'string' ? callArg : '';
    expect(url).toContain('/abc123/');
    expect(url).not.toContain('edit');
  });

  it('should use plain doc ID directly', async () => {
    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<html><body>test</body></html>', { status: 200 }));

    await importFromGoogleDocs('my-doc-id', 'token');

    const callArg = mockFetch.mock.calls[0]?.[0];
    const url = typeof callArg === 'string' ? callArg : '';
    expect(url).toContain('/my-doc-id/');
  });

  it('should throw UNAUTHORIZED for 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Unauthorized', { status: 401 }))
    );

    try {
      await importFromGoogleDocs('doc', 'bad-token');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GoogleDocsImportError);
      expect((e as GoogleDocsImportError).code).toBe('UNAUTHORIZED');
    }
  });

  it('should throw UNAUTHORIZED for 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Forbidden', { status: 403 }))
    );

    await expect(importFromGoogleDocs('doc', 'token')).rejects.toThrow(GoogleDocsImportError);
  });

  it('should throw NOT_FOUND for 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Not Found', { status: 404 }))
    );

    try {
      await importFromGoogleDocs('bad-doc', 'token');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GoogleDocsImportError);
      expect((e as GoogleDocsImportError).code).toBe('NOT_FOUND');
    }
  });

  it('should throw API_ERROR for other HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Server Error', { status: 500 }))
    );

    try {
      await importFromGoogleDocs('doc', 'token');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GoogleDocsImportError);
      expect((e as GoogleDocsImportError).code).toBe('API_ERROR');
    }
  });

  it('should warn when converted content is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body></body></html>', { status: 200 })
    );

    vi.mocked(convertHtmlToMdx).mockResolvedValue('');

    const result = await importFromGoogleDocs('doc', 'token');
    expect(result.warnings).toContain('Document appears to be empty after conversion');
  });
});
