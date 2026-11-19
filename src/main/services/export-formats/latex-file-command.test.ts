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
});
