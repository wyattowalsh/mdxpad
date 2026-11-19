import { describe, expect, it } from 'vitest';

import { disarmFileReadsInMath, omitTexPictureSyntax } from './latex-file-command';

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

  it('turns a Lua or shell command inside a formula into text', () => {
    const source = '$$\n\\directlua{io.open("secret")}\n$$\n\n$\\ShellEscape{cat secret}$ and $\\frac{1}{2}$.\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\directlua');
    expect(next).not.toContain('\\ShellEscape');
    expect(next).toContain('\\relax directlua');
    expect(next).toContain('\\relax ShellEscape');
    expect(next).toContain('\\frac{1}{2}');
  });

  it('turns a shell stream and an openout stream inside a formula into text', () => {
    const source = '$$\n\\immediate\\write18{cat secret}\n$$\n\n$\\openout5=secret.tex$ and $\\frac{1}{2}$ and $\\inputfoo$.\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\write');
    expect(next).not.toContain('\\openout');
    expect(next).toContain('\\relax write18');
    expect(next).toContain('\\relax openout5');
    expect(next).toContain('\\frac{1}{2}');
    expect(next).toContain('\\inputfoo');
  });
});

describe('disarmLatexFileRead caret escapes', () => {
  it('breaks a caret escape that would become a file command and keeps a power', () => {
    const source = '$$\n^^5cinput{secret}\n$$\n\n$a^2$ and $x^{2}$.\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('^^');
    expect(next).toContain('^{}5cinput');
    expect(next).toContain('$a^2$');
    expect(next).toContain('$x^{2}$');
  });
});

describe('omitTexPictureSyntax', () => {
  it('leaves the alt text when a picture path can become a TeX command', () => {
    const source = [
      '![Secret](^^5cinput{secret.png)',
      '',
      '![Pixel](pixel.png "a^b")',
      '',
      '```',
      '![Secret](^^5cinput{secret.png)',
      '```',
      '',
    ].join('\n');
    const next = omitTexPictureSyntax(source);
    const prose = next.slice(0, next.indexOf('```'));
    expect(prose).not.toContain('^^');
    expect(prose).toContain('Secret');
    expect(prose).toContain('![Pixel](pixel.png "a^b")');
    expect(next).toContain('```\n![Secret](^^5cinput{secret.png)\n```');
  });
});
