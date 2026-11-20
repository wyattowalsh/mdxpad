/**
 * Citation formatter tests.
 * Tests citation formatting in various styles and bibliography generation.
 */

import { describe, it, expect } from 'vitest';
import { formatCitation, generateBibliography } from './citation-formatter';
import { parseBibtex } from './citation-service';
import type { CitationEntry } from '@shared/contracts/citation-schemas';

const sampleArticle: CitationEntry = {
  id: 'smith2024',
  type: 'article',
  title: 'Machine Learning Advances',
  author: [
    { given: 'John', family: 'Smith' },
    { given: 'Jane', family: 'Doe' },
  ],
  year: 2024,
  journal: 'Nature',
  volume: '42',
  issue: '3',
  pages: '100-120',
  doi: '10.1234/test',
};

const sampleBook: CitationEntry = {
  id: 'brown2023',
  type: 'book',
  title: 'Data Science Handbook',
  author: [{ given: 'Alice', family: 'Brown' }],
  year: 2023,
  publisher: 'Academic Press',
};

describe('citation-formatter', () => {
  it('keeps a proceedings title and a note', () => {
    const entry: CitationEntry = {
      id: 'ada2020',
      type: 'inproceedings',
      title: 'Widgets',
      author: [{ given: 'Ada', family: 'Lovelace' }],
      year: 2020,
      booktitle: 'Proceedings of the Ice Conference',
      note: 'See the appendix',
    };
    for (const style of ['apa', 'mla', 'chicago', 'ieee'] as const) {
      const formatted = formatCitation(entry, style).formatted;
      expect(formatted).toContain('Proceedings of the Ice Conference');
      expect(formatted).toContain('See the appendix');
    }
  });

  it('keeps a school, an institution, an editor, and where it was presented', () => {
    const entry: CitationEntry = {
      id: 'ada1843',
      type: 'phdthesis',
      title: 'The Ice',
      author: [{ given: 'Ada', family: 'Lovelace' }],
      year: 1843,
      school: 'University of the North',
      institution: 'Analytical Engines',
      editor: 'Charles Babbage',
      howpublished: 'Presented at the Ice Symposium',
    };
    const formatted = formatCitation(entry, 'apa').formatted;
    expect(formatted).toContain('University of the North');
    expect(formatted).toContain('Analytical Engines');
    expect(formatted).toContain('Charles Babbage');
    expect(formatted).toContain('Presented at the Ice Symposium');
  });

  it('keeps a series, a city, an edition, an organization, and a chapter', () => {
    const entry: CitationEntry = {
      id: 'ada1842',
      type: 'incollection',
      title: 'The Engine',
      author: [{ family: 'Lovelace' }],
      year: 1842,
      series: 'Lecture Notes in Computer Science',
      address: 'London',
      edition: 'Second',
      organization: 'Analytical Society',
      chapter: 'On the Engine',
    };
    const formatted = formatCitation(entry, 'chicago').formatted;
    expect(formatted).toContain('Lecture Notes in Computer Science');
    expect(formatted).toContain('London');
    expect(formatted).toContain('Second');
    expect(formatted).toContain('Analytical Society');
    expect(formatted).toContain('On the Engine');
  });

  it('keeps a journal title, a date, a place, an ISSN, and a link', () => {
    const parsed = parseBibtex(`
@article{ada1843,
  author = {Ada Lovelace},
  title = {The Engine},
  journaltitle = {Annals of Ice},
  date = {1843-01-15},
  location = {London},
  issn = {1234-5678},
  url = {https://example.com/ice}
}`);
    const entry = parsed.entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    const formatted = formatCitation(entry, 'apa').formatted;
    expect(formatted).toContain('Annals of Ice');
    expect(formatted).toContain('(1843)');
    expect(formatted).toContain('15 January');
    expect(formatted).toContain('London');
    expect(formatted).toContain('1234-5678');
    expect(formatted).toContain('https://example.com/ice');
  });

  it('keeps an article number, a language, an access date, a version, a venue, and a page count', () => {
    const entry: CitationEntry = {
      id: 'ada1843',
      type: 'article',
      title: 'The Engine',
      author: [{ family: 'Lovelace' }],
      year: 1843,
      eid: 'e12ice',
      language: 'English',
      urldate: '2020-01-02',
      version: '1.2',
      venue: 'Ice Hall',
      pagetotal: '40',
    };
    const formatted = formatCitation(entry, 'chicago').formatted;
    expect(formatted).toContain('e12ice');
    expect(formatted).toContain('English');
    expect(formatted).toContain('Accessed 2 January 2020');
    expect(formatted).toContain('Version 1.2');
    expect(formatted).toContain('Ice Hall');
    expect(formatted).toContain('40 pp.');
  });

  it('keeps a subtitle, a month, a translator, and an ISBN', () => {
    const entry: CitationEntry = {
      id: 'ada1840',
      type: 'book',
      title: 'The Engine',
      subtitle: 'A Study of Ice',
      author: [{ family: 'Lovelace' }],
      year: 1840,
      month: 'jan',
      translator: 'Charles Babbage',
      isbn: '978-1-840-00000-1',
    };
    const formatted = formatCitation(entry, 'apa').formatted;
    expect(formatted).toContain('The Engine: A Study of Ice');
    expect(formatted).toContain('January');
    expect(formatted).toContain('Charles Babbage');
    expect(formatted).toContain('978-1-840-00000-1');
  });

  describe('formatCitation', () => {
    describe('APA style', () => {
      it('should format article citation', () => {
        const result = formatCitation(sampleArticle, 'apa');
        expect(result.formatted).toContain('Smith, J., & Doe, J.');
        expect(result.formatted).toContain('(2024)');
        expect(result.formatted).toContain('Machine Learning Advances');
        expect(result.formatted).toContain('_Nature_');
      });

      it('uses an ampersand before the last author of a long list', () => {
        const author = Array.from({ length: 8 }, (_, index) => ({
          family: `Author${index}`,
          given: 'A',
        }));
        const result = formatCitation(
          { id: 'long', type: 'article', title: 'Long', author, year: 2024 },
          'apa'
        );
        expect(result.formatted).toContain('... & Author7, A.');
      });

      it('should format book citation', () => {
        const result = formatCitation(sampleBook, 'apa');
        expect(result.formatted).toContain('Brown, A.');
        expect(result.formatted).toContain('(2023)');
        expect(result.formatted).toContain('Academic Press');
      });

      it('should generate inline reference', () => {
        const result = formatCitation(sampleArticle, 'apa');
        expect(result.inlineRef).toBe('(Smith, 2024)');
      });
    });

    describe('MLA style', () => {
      it('should format article citation', () => {
        const result = formatCitation(sampleArticle, 'mla');
        expect(result.formatted).toContain('Smith, John');
        expect(result.formatted).toContain('"Machine Learning Advances."');
        expect(result.formatted).toContain('_Nature_');
      });

      it('builds an MLA in-text citation with one closing parenthesis', () => {
        const withPages = formatCitation(sampleArticle, 'mla');
        expect(withPages.inlineRef).toBe('(Smith 100-120)');
        const withoutPages = formatCitation(sampleBook, 'mla');
        expect(withoutPages.inlineRef).toBe('(Brown)');
      });

      it('should format book citation', () => {
        const result = formatCitation(sampleBook, 'mla');
        expect(result.formatted).toContain('Brown, Alice');
        expect(result.formatted).toContain('2023');
      });
    });

    describe('Chicago style', () => {
      it('should format article citation', () => {
        const result = formatCitation(sampleArticle, 'chicago');
        expect(result.formatted).toContain('Smith, John');
        expect(result.formatted).toContain('"Machine Learning Advances."');
        expect(result.formatted).toContain('_Nature_');
        expect(result.formatted).toContain('(2024)');
      });

      it('should generate inline reference', () => {
        const result = formatCitation(sampleArticle, 'chicago');
        expect(result.inlineRef).toBe('(Smith 2024)');
      });
    });

    describe('IEEE style', () => {
      it('should format article citation', () => {
        const result = formatCitation(sampleArticle, 'ieee');
        expect(result.formatted).toContain('J. Smith');
        expect(result.formatted).toContain('"Machine Learning Advances,"');
        expect(result.formatted).toContain('_Nature_');
      });

      it('should generate inline reference with ID', () => {
        const result = formatCitation(sampleArticle, 'ieee');
        expect(result.inlineRef).toBe('[smith2024]');
      });
    });

    it('should handle entry with no authors', () => {
      const entry: CitationEntry = {
        id: 'anon',
        type: 'article',
        title: 'Anonymous Work',
        year: 2024,
      };
      const result = formatCitation(entry, 'apa');
      expect(result.formatted).toContain('Unknown Author');
    });

    it('should handle entry with no year', () => {
      const entry: CitationEntry = {
        id: 'noyear',
        type: 'article',
        title: 'Undated Work',
        author: [{ given: 'Test', family: 'Author' }],
      };
      const result = formatCitation(entry, 'apa');
      expect(result.formatted).toContain('(n.d.)');
    });
  });

  describe('generateBibliography', () => {
    it('should generate bibliography with multiple entries', () => {
      const result = generateBibliography([sampleArticle, sampleBook], 'apa');
      expect(result.entryCount).toBe(2);
      expect(result.bibliography).toContain('Smith');
      expect(result.bibliography).toContain('Brown');
    });

    it('should sort entries alphabetically by first author family name', () => {
      const result = generateBibliography([sampleArticle, sampleBook], 'apa');
      const brownIndex = result.bibliography.indexOf('Brown');
      const smithIndex = result.bibliography.indexOf('Smith');
      expect(brownIndex).toBeLessThan(smithIndex);
    });

    it('should use numbered format for IEEE', () => {
      const result = generateBibliography([sampleArticle], 'ieee');
      expect(result.bibliography).toMatch(/^\[1\]/);
    });

    it('should separate entries with blank lines', () => {
      const result = generateBibliography([sampleArticle, sampleBook], 'apa');
      expect(result.bibliography).toContain('\n\n');
    });
  });
});
