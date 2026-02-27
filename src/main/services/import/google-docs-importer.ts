/**
 * Google Docs importer.
 * Exports a Google Doc as HTML and converts to MDX.
 * Uses direct HTTP calls to keep dependency footprint small.
 *
 * @module google-docs-importer
 */

import { convertHtmlToMdx } from './html-to-mdx-converter';

export class GoogleDocsImportError extends Error {
  readonly code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'API_ERROR';
  constructor(message: string, code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'API_ERROR') {
    super(message);
    this.name = 'GoogleDocsImportError';
    this.code = code;
  }
}

function extractDocId(docIdOrUrl: string): string {
  // Handle full URLs: https://docs.google.com/document/d/{docId}/...
  const urlMatch = /\/document\/d\/([a-zA-Z0-9_-]+)/.exec(docIdOrUrl);
  if (urlMatch?.[1]) return urlMatch[1];
  // Assume it's already a doc ID
  return docIdOrUrl;
}

export async function importFromGoogleDocs(
  docId: string,
  accessToken: string
): Promise<{ content: string; title?: string; warnings: string[] }> {
  const cleanId = extractDocId(docId);
  const warnings: string[] = [];

  // Export as HTML via Google Docs export URL
  const exportUrl = `https://docs.google.com/document/d/${cleanId}/export?format=html`;
  const response = await fetch(exportUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GoogleDocsImportError(
        'Unauthorized: invalid or expired access token',
        'UNAUTHORIZED'
      );
    }
    if (response.status === 404) {
      throw new GoogleDocsImportError('Document not found', 'NOT_FOUND');
    }
    const body = await response.text();
    throw new GoogleDocsImportError(
      `Google Docs API error (${response.status}): ${body}`,
      'API_ERROR'
    );
  }

  const html = await response.text();

  // Try to extract title from HTML <title> tag
  const titleMatch = /<title>([^<]*)<\/title>/i.exec(html);
  const trimmedTitle = titleMatch?.[1]?.trim();
  const title = trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : undefined;

  // Convert HTML to MDX
  const content = await convertHtmlToMdx(html);

  if (!content.trim()) {
    warnings.push('Document appears to be empty after conversion');
  }

  const result: { content: string; title?: string; warnings: string[] } = {
    content,
    warnings,
  };
  if (title !== undefined) {
    result.title = title;
  }
  return result;
}
