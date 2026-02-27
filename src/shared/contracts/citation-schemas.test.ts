/**
 * Citation schema validation tests.
 */

import { describe, it, expect } from 'vitest';
import {
  ParseBibtexRequestSchema,
  FormatCitationRequestSchema,
  GenerateBibliographyRequestSchema,
  CitationEntrySchema,
  CitationStyleSchema,
} from './citation-schemas';

describe('citation-schemas', () => {
  describe('CitationStyleSchema', () => {
    it('should accept valid styles', () => {
      for (const style of ['apa', 'mla', 'chicago', 'ieee']) {
        expect(CitationStyleSchema.safeParse(style).success).toBe(true);
      }
    });

    it('should reject invalid style', () => {
      expect(CitationStyleSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('CitationEntrySchema', () => {
    it('should accept minimal entry', () => {
      const result = CitationEntrySchema.safeParse({
        id: 'test',
        type: 'article',
      });
      expect(result.success).toBe(true);
    });

    it('should accept full entry', () => {
      const result = CitationEntrySchema.safeParse({
        id: 'smith2024',
        type: 'article',
        title: 'A Paper',
        author: [{ given: 'John', family: 'Smith' }],
        year: 2024,
        journal: 'Nature',
        volume: '42',
        issue: '3',
        pages: '1-10',
        publisher: 'Press',
        doi: '10.1234/test',
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ParseBibtexRequestSchema', () => {
    it('should accept valid bibtex string', () => {
      const result = ParseBibtexRequestSchema.safeParse({
        bibtex: '@article{test, title={Title}}',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty bibtex', () => {
      const result = ParseBibtexRequestSchema.safeParse({ bibtex: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('FormatCitationRequestSchema', () => {
    it('should accept valid format request', () => {
      const result = FormatCitationRequestSchema.safeParse({
        entry: { id: 'test', type: 'article' },
        style: 'apa',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GenerateBibliographyRequestSchema', () => {
    it('should accept valid bibliography request', () => {
      const result = GenerateBibliographyRequestSchema.safeParse({
        entries: [{ id: 'test', type: 'article' }],
        style: 'mla',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty entries array', () => {
      const result = GenerateBibliographyRequestSchema.safeParse({
        entries: [],
        style: 'apa',
      });
      expect(result.success).toBe(false);
    });
  });
});
