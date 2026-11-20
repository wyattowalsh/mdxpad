/**
 * Citation service tests.
 * Tests BibTeX parsing.
 */

import { describe, it, expect } from 'vitest';
import { parseBibtex } from './citation-service';

describe('citation-service', () => {
  describe('parseBibtex', () => {
    it('should parse a simple article entry', () => {
      const bibtex = `
@article{smith2024,
  author = {Smith, John and Doe, Jane},
  title = {A Great Paper},
  journal = {Nature},
  year = {2024},
  volume = {42},
  pages = {1--10}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.id).toBe('smith2024');
      expect(result.entries[0]?.type).toBe('article');
      expect(result.entries[0]?.title).toBe('A Great Paper');
      expect(result.entries[0]?.year).toBe(2024);
      expect(result.entries[0]?.journal).toBe('Nature');
      expect(result.entries[0]?.volume).toBe('42');
      expect(result.entries[0]?.pages).toBe('1-10');
    });

    it('normalizes every en-dash page range', () => {
      const result = parseBibtex(`
@article{ranges,
  title = {Ranges},
  pages = {1--10, 12--14}
}`);
      expect(result.entries[0]?.pages).toBe('1-10, 12-14');
    });

    it('should parse author names in "Last, First" format', () => {
      const bibtex = `
@article{test,
  author = {Einstein, Albert},
  title = {Relativity}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.author).toEqual([{ family: 'Einstein', given: 'Albert' }]);
    });

    it('should parse author names in "First Last" format', () => {
      const bibtex = `
@article{test,
  author = {Albert Einstein},
  title = {Relativity}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.author).toEqual([{ given: 'Albert', family: 'Einstein' }]);
    });

    it('should parse multiple authors', () => {
      const bibtex = `
@article{test,
  author = {Smith, John and Doe, Jane and Brown, Bob},
  title = {Team Paper}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.author).toHaveLength(3);
    });

    it('keeps the rest of a title that protects a word in braces', () => {
      const bibtex = `
@article{nasa2024,
  title = {The {NASA} Report},
  year = {2024},
  journal = {Space Science}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.title).toBe('The NASA Report');
      expect(result.entries[0]?.year).toBe(2024);
      expect(result.entries[0]?.journal).toBe('Space Science');
    });

    it('should parse multiple entries', () => {
      const bibtex = `
@article{first,
  title = {First Paper},
  year = {2020}
}
@inproceedings{second,
  title = {Second Paper},
  year = {2021}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]?.id).toBe('first');
      expect(result.entries[1]?.id).toBe('second');
    });

    it('should handle DOI and URL fields', () => {
      const bibtex = `
@article{test,
  title = {DOI Paper},
  doi = {10.1234/test},
  url = {https://example.com/paper}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.doi).toBe('10.1234/test');
      expect(result.entries[0]?.url).toBe('https://example.com/paper');
    });

    it('keeps a proceedings title, a note, and an unbraced name', () => {
      const result = parseBibtex(`
@inproceedings{ada2020,
  title = {Widgets},
  author = {Ada Lovelace},
  booktitle = {Proceedings of the Ice Conference},
  publisher = MIT,
  year = {2020},
  note = {See the appendix}
}`);
      expect(result.entries[0]?.booktitle).toBe('Proceedings of the Ice Conference');
      expect(result.entries[0]?.note).toBe('See the appendix');
      expect(result.entries[0]?.publisher).toBe('MIT');
    });

    it('keeps a school, an institution, an editor, and where it was presented', () => {
      const result = parseBibtex(`
@phdthesis{ada1843,
  title = {The Ice},
  author = {Ada Lovelace},
  school = {University of the North},
  institution = {Analytical Engines},
  editor = {Charles Babbage},
  howpublished = {Presented at the Ice Symposium},
  year = {1843}
}`);
      expect(result.entries[0]?.school).toBe('University of the North');
      expect(result.entries[0]?.institution).toBe('Analytical Engines');
      expect(result.entries[0]?.editor).toBe('Charles Babbage');
      expect(result.entries[0]?.howpublished).toBe('Presented at the Ice Symposium');
    });

    it('keeps a series, a city, an edition, an organization, and a chapter', () => {
      const result = parseBibtex(`
@incollection{ada1842,
  title = {The Engine},
  series = {Lecture Notes in Computer Science},
  address = {London},
  edition = {Second},
  organization = {Analytical Society},
  chapter = {On the Engine}
}`);
      expect(result.entries[0]?.series).toBe('Lecture Notes in Computer Science');
      expect(result.entries[0]?.address).toBe('London');
      expect(result.entries[0]?.edition).toBe('Second');
      expect(result.entries[0]?.organization).toBe('Analytical Society');
      expect(result.entries[0]?.chapter).toBe('On the Engine');
    });

    it('should handle publisher field', () => {
      const bibtex = `
@book{test,
  title = {A Book},
  publisher = {Academic Press},
  year = {2023}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.publisher).toBe('Academic Press');
    });

    it('should handle number/issue field', () => {
      const bibtex = `
@article{test,
  title = {Paper},
  number = {3}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.issue).toBe('3');
    });

    it('should skip @comment and @preamble entries', () => {
      const bibtex = `
@comment{This is a comment}
@preamble{Some preamble}
@article{real,
  title = {Real Paper}
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.id).toBe('real');
    });

    it('should warn for empty results with @ signs present', () => {
      const bibtex = `@malformed{`;
      const result = parseBibtex(bibtex);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle quoted field values', () => {
      const bibtex = `
@article{test,
  title = "Quoted Title",
  year = 2024
}`;
      const result = parseBibtex(bibtex);
      expect(result.entries[0]?.title).toBe('Quoted Title');
      expect(result.entries[0]?.year).toBe(2024);
    });

    it('should return empty entries for non-bibtex input', () => {
      const result = parseBibtex('just some random text');
      expect(result.entries).toHaveLength(0);
    });
  });
});
