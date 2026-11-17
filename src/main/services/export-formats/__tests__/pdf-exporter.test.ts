import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PdfExporter } from '../pdf-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const mockPrintToPDF = vi.fn().mockResolvedValue(Buffer.from('fake-pdf'));
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();
const mockIsDestroyed = vi.fn().mockReturnValue(false);

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: mockLoadURL,
    webContents: {
      printToPDF: mockPrintToPDF,
    },
    destroy: mockDestroy,
    isDestroyed: mockIsDestroyed,
  })),
}));

describe('PdfExporter', () => {
  let exporter: PdfExporter;

  beforeEach(() => {
    exporter = new PdfExporter();
    vi.clearAllMocks();
    mockIsDestroyed.mockReturnValue(false);
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('pdf');
    expect(exporter.label).toBe('PDF');
    expect(exporter.extension).toBe('pdf');
    expect(exporter.mimeType).toBe('application/pdf');
  });

  it('creates a hidden BrowserWindow and calls printToPDF', async () => {
    const { BrowserWindow } = await import('electron');
    const options: ExportOptions = {
      content: '# Hello World',
      title: 'Test PDF',
      outputPath: '/tmp/test.pdf',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe('/tmp/test.pdf');
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        show: false,
        webPreferences: expect.objectContaining({
          offscreen: true,
          nodeIntegration: false,
          contextIsolation: true,
        }),
      })
    );
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    expect(typeof loadedUrl).toBe('string');
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<h1>Hello World</h1>');
    expect(html).not.toContain('<pre style="white-space: pre-wrap;">');
    expect(mockLoadURL).toHaveBeenCalledOnce();
    expect(mockPrintToPDF).toHaveBeenCalledOnce();
  });

  it('groups consecutive list items into one list', async () => {
    const options: ExportOptions = {
      content: '- one\n- two\n\n1. first\n2. second',
      outputPath: '/tmp/lists.pdf',
    };
    await exporter.export(options);
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>first</li>\n<li>second</li>\n</ol>');
    expect(html).not.toContain('<ul><li>');
  });

  it('renders a formula and a display block', async () => {
    await exporter.export({
      content: 'See $x^2$.\n$$\nE = mc^2\n$$',
      outputPath: '/tmp/math.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<math');
    expect(html).toContain('E = mc^2');
    expect(html).not.toContain('$x^2$');
  });

  it('writes PDF buffer to output path', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Test',
      outputPath: '/tmp/output.pdf',
    };

    await exporter.export(options);

    expect(writeFile).toHaveBeenCalledWith('/tmp/output.pdf', Buffer.from('fake-pdf'));
  });

  it('destroys the hidden window after export', async () => {
    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/test.pdf',
    };

    await exporter.export(options);

    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('destroys window even on error', async () => {
    mockPrintToPDF.mockRejectedValueOnce(new Error('print failed'));

    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/fail.pdf',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('print failed');
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('does not destroy already-destroyed window', async () => {
    mockIsDestroyed.mockReturnValue(true);

    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/test.pdf',
    };

    await exporter.export(options);

    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it('passes margin options from metadata', async () => {
    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/margins.pdf',
      metadata: {
        margins: { top: 1, right: 1, bottom: 1, left: 1 },
        landscape: true,
        pageSize: 'Letter',
      },
    };

    await exporter.export(options);

    expect(mockPrintToPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        landscape: true,
        margins: { top: 1, right: 1, bottom: 1, left: 1 },
      })
    );
  });
});
