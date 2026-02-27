import { describe, it, expect } from 'vitest';

import {
  getExporter,
  getAllExporters,
  getNewExportSupportEntries,
  PdfExporter,
  DocxExporter,
  EpubExporter,
  LatexExporter,
  PandocRawExporter,
} from '../index';

describe('export-formats barrel', () => {
  describe('getExporter', () => {
    it('returns pdf exporter for "pdf"', () => {
      const exporter = getExporter('pdf');
      expect(exporter).toBeInstanceOf(PdfExporter);
    });

    it('returns docx exporter for "docx"', () => {
      const exporter = getExporter('docx');
      expect(exporter).toBeInstanceOf(DocxExporter);
    });

    it('returns epub exporter for "epub"', () => {
      const exporter = getExporter('epub');
      expect(exporter).toBeInstanceOf(EpubExporter);
    });

    it('returns latex exporter for "latex"', () => {
      const exporter = getExporter('latex');
      expect(exporter).toBeInstanceOf(LatexExporter);
    });

    it('returns pandoc exporter for "pandoc"', () => {
      const exporter = getExporter('pandoc');
      expect(exporter).toBeInstanceOf(PandocRawExporter);
    });

    it('returns undefined for unknown format', () => {
      expect(getExporter('unknown')).toBeUndefined();
    });
  });

  describe('getAllExporters', () => {
    it('returns all five exporters', () => {
      const exporters = getAllExporters();
      expect(exporters).toHaveLength(5);
      const formats = exporters.map((e) => e.format);
      expect(formats).toContain('pdf');
      expect(formats).toContain('docx');
      expect(formats).toContain('epub');
      expect(formats).toContain('latex');
      expect(formats).toContain('pandoc');
    });

    it('returns a new array each time', () => {
      const a = getAllExporters();
      const b = getAllExporters();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('getNewExportSupportEntries', () => {
    it('returns entries for pdf, docx, epub, latex, pandoc', () => {
      const entries = getNewExportSupportEntries();
      expect(entries).toHaveLength(5);
      const formats = entries.map((e) => e.format);
      expect(formats).toContain('pdf');
      expect(formats).toContain('docx');
      expect(formats).toContain('epub');
      expect(formats).toContain('latex');
      expect(formats).toContain('pandoc');
    });

    it('marks all new formats as supported', () => {
      const entries = getNewExportSupportEntries();
      for (const entry of entries) {
        expect(entry.supported).toBe(true);
      }
    });

    it('has valid extension, label, and mimeType for each entry', () => {
      const entries = getNewExportSupportEntries();
      for (const entry of entries) {
        expect(entry.extension.length).toBeGreaterThan(0);
        expect(entry.label.length).toBeGreaterThan(0);
        expect(entry.mimeType.length).toBeGreaterThan(0);
        expect(entry.priority).toBeGreaterThan(0);
      }
    });
  });
});
