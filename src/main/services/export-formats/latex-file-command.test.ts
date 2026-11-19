import { describe, expect, it } from 'vitest';

import { disarmFileReadsInMath } from './latex-file-command';

describe('disarmFileReadsInMath', () => {
  it('turns a file command inside a formula into text and keeps a fenced sample', () => {
    const source = [
      '$$',
      '\\input{secret.tex}',
      '$$',
      '',
      'See $\\include{secret}$ and $\\frac{1}{2}$.',
      '',
      '```',
      '\\input{secret.tex}',
      '```',
      '',
    ].join('\n');
    const next = disarmFileReadsInMath(source);
    const formula = next.slice(0, next.indexOf('```'));
    expect(formula).not.toContain('\\input');
    expect(formula).not.toContain('\\include');
    expect(formula).toContain('\\relax input');
    expect(formula).toContain('\\frac{1}{2}');
    expect(next).toContain('```\n\\input{secret.tex}\n```');
  });

  it('turns a constructed file command inside a formula into text', () => {
    const source = '$$\n\\@@input{secret}\n$$\n\n$\\csname input\\endcsname{secret}$ and $\\frac{1}{2}$.\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\@@input');
    expect(next).not.toContain('\\csname');
    expect(next).toContain('\\relax @@input');
    expect(next).toContain('\\relax csname');
    expect(next).toContain('\\frac{1}{2}');
  });

  it('turns a pdf file primitive inside a formula into text', () => {
    const source = '$$\n\\pdffiledump{secret}\n$$\n\n$\\special{pdf:fopen (secret)}$\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\pdffiledump');
    expect(next).not.toContain('\\special');
    expect(next).toContain('\\relax pdffiledump');
    expect(next).toContain('\\relax special');
  });
});
