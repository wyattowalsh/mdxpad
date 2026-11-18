import { describe, expect, it } from 'vitest';

import { docxTocEntries, shiftDocxHeadings } from './docx-heading-options';

describe('docx heading options', () => {
  it('raises headings and leaves a fenced heading alone', () => {
    const source = ['# Title', '', '```', '# Not a heading', '```', '', '## Section'].join('\n');

    const shifted = shiftDocxHeadings(source, 2);

    expect(shifted).toContain('## Title');
    expect(shifted).toContain('### Section');
    expect(shifted).toContain('# Not a heading');
    expect(docxTocEntries(shifted)).toEqual(['Title', 'Section']);
  });
});
