import { describe, it, expect } from 'vitest';

import {
  PdfExportOptionsSchema,
  DocxExportOptionsSchema,
  EpubExportOptionsSchema,
  LatexExportOptionsSchema,
  PandocExportOptionsSchema,
} from '@shared/contracts/export-format-schemas';

describe('PdfExportOptionsSchema', () => {
  it('accepts valid options', () => {
    const result = PdfExportOptionsSchema.parse({
      margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
      landscape: true,
      pageSize: 'A4',
    });
    expect(result.landscape).toBe(true);
    expect(result.pageSize).toBe('A4');
  });

  it('accepts empty object', () => {
    const result = PdfExportOptionsSchema.parse({});
    expect(result.margins).toBeUndefined();
  });

  it('rejects invalid page size', () => {
    expect(() => PdfExportOptionsSchema.parse({ pageSize: 'Tabloid' })).toThrow();
  });

  it('rejects negative margins', () => {
    expect(() =>
      PdfExportOptionsSchema.parse({
        margins: { top: -1, right: 0, bottom: 0, left: 0 },
      })
    ).toThrow();
  });
});

describe('DocxExportOptionsSchema', () => {
  it('accepts valid options', () => {
    const result = DocxExportOptionsSchema.parse({
      title: 'My Doc',
      author: 'Author',
      includeTableOfContents: true,
      headingBaseLevel: 2,
    });
    expect(result.title).toBe('My Doc');
    expect(result.headingBaseLevel).toBe(2);
  });

  it('rejects heading level out of range', () => {
    expect(() => DocxExportOptionsSchema.parse({ headingBaseLevel: 7 })).toThrow();
  });
});

describe('EpubExportOptionsSchema', () => {
  it('accepts valid options', () => {
    const result = EpubExportOptionsSchema.parse({
      title: 'My Book',
      author: 'Writer',
      language: 'en',
    });
    expect(result.title).toBe('My Book');
  });

  it('accepts empty object', () => {
    const result = EpubExportOptionsSchema.parse({});
    expect(result.title).toBeUndefined();
  });
});

describe('LatexExportOptionsSchema', () => {
  it('accepts valid document class', () => {
    const result = LatexExportOptionsSchema.parse({
      documentClass: 'report',
      fontSize: '12pt',
    });
    expect(result.documentClass).toBe('report');
  });

  it('rejects invalid document class', () => {
    expect(() => LatexExportOptionsSchema.parse({ documentClass: 'thesis' })).toThrow();
  });
});

describe('PandocExportOptionsSchema', () => {
  it('accepts valid options', () => {
    const result = PandocExportOptionsSchema.parse({
      to: 'html',
      from: 'markdown',
      timeoutMs: 30000,
      extraArgs: ['--standalone'],
    });
    expect(result.to).toBe('html');
  });

  it('requires "to" field', () => {
    expect(() => PandocExportOptionsSchema.parse({})).toThrow();
  });

  it('rejects timeout exceeding maximum', () => {
    expect(() => PandocExportOptionsSchema.parse({ to: 'html', timeoutMs: 200000 })).toThrow();
  });
});
