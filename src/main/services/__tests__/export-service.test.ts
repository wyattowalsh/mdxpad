import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  EXPORT_SUPPORT_MATRIX,
  contentForExport,
  getDefaultExportPath,
  serializeForExport,
} from '../export-service';

describe('EXPORT_SUPPORT_MATRIX', () => {
  it('marks html, markdown, mdx, pdf, and docx as supported', () => {
    const supportByFormat = new Map(
      EXPORT_SUPPORT_MATRIX.map((entry) => [entry.format, entry.supported])
    );

    expect(supportByFormat.get('html')).toBe(true);
    expect(supportByFormat.get('markdown')).toBe(true);
    expect(supportByFormat.get('mdx')).toBe(true);
    expect(supportByFormat.get('pdf')).toBe(true);
    expect(supportByFormat.get('docx')).toBe(true);
    expect(supportByFormat.get('epub')).toBe(true);
    expect(supportByFormat.get('latex')).toBe(true);
    expect(supportByFormat.get('pandoc')).toBe(true);
  });
});

describe('getDefaultExportPath', () => {
  it('uses source filename when available', () => {
    expect(getDefaultExportPath('/tmp/docs/spec.mdx', 'html')).toBe('/tmp/docs/spec.html');
  });

  it('falls back to untitled basename when source path is missing', () => {
    expect(getDefaultExportPath(null, 'markdown')).toBe('untitled.md');
  });

  it('does not use the HTML export path for Pandoc', () => {
    expect(getDefaultExportPath('/tmp/docs/spec.mdx', 'pandoc')).toBe('/tmp/docs/spec.pandoc.html');
    expect(getDefaultExportPath(null, 'pandoc')).toBe('untitled.pandoc.html');
    expect(getDefaultExportPath('/tmp/docs/spec.mdx', 'html')).toBe('/tmp/docs/spec.html');
  });
});

describe('serializeForExport', () => {
  it('returns explicit unsupported-format errors for pdf/docx', () => {
    const pdf = serializeForExport('# hello', 'pdf');
    const docx = serializeForExport('# hello', 'docx');

    expect(pdf.ok).toBe(false);
    expect(docx.ok).toBe(false);

    if (!pdf.ok) {
      expect(pdf.error.code).toBe('UNSUPPORTED_FORMAT');
      if (pdf.error.code === 'UNSUPPORTED_FORMAT') {
        expect(pdf.error.format).toBe('pdf');
      }
    }
    if (!docx.ok) {
      expect(docx.error.code).toBe('UNSUPPORTED_FORMAT');
      if (docx.error.code === 'UNSUPPORTED_FORMAT') {
        expect(docx.error.format).toBe('docx');
      }
    }
  });

  it('renders markdown instead of a source dump', () => {
    const result = serializeForExport('# Title\n\nHello **there**', 'html');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('border: 1px solid #d1d5db');
      expect(result.content).toContain('text-align: left');
      expect(result.content).toContain('<h1 id="title">Title</h1>');
      expect(result.content).toContain('<strong>there</strong>');
      expect(result.content).not.toContain('mdxpad-export-source');
    }
  });

  it('styles parenthesis and bullet markers in html export', () => {
    const result = serializeForExport('1) one\n\n+ plus\n* star', 'html');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('<ol class="paren"');
      expect(result.content).toContain('<ul class="plus">');
      expect(result.content).toContain('<ul class="star">');
      expect(result.content).toContain('ol.paren > li::before');
      expect(result.content).toContain('ul.plus > li::before');
      expect(result.content).toContain('ul.star > li::before');
    }
  });

  it('generates html export with mermaid rendering hook for mermaid fences', () => {
    const result = serializeForExport('```mermaid\ngraph TD\n  A-->B\n```', 'html');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('class="mermaid"');
      expect(result.content).toContain('cdn.jsdelivr.net/npm/mermaid');
    }
  });

  it('embeds a local image in an HTML file export', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-html-image-'));
    const source = path.join(root, 'note.md');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await writeFile(path.join(root, 'pixel.png'), png);
    const prepared = await contentForExport('![Pixel](pixel.png)', 'html', source);
    const result = serializeForExport(prepared, 'html');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('src="data:image/png;base64,');
      expect(result.content).not.toContain('src="pixel.png"');
    }
  });
});
