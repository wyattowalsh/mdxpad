import { describe, expect, it } from 'vitest';

import { disarmFileReadsInMath, disarmPandocRawTex, omitTexPictureSyntax } from './latex-file-command';

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

  it('turns a name built without csname inside a formula into text', () => {
    const source = [
      '$$',
      '\\begincsname input\\endcsname{secret}',
      '\\UseName{input}{secret}',
      '\\pdfextension image file {secret.png}',
      '\\ExplSyntaxOn',
      '\\file_input:n {secret}',
      '\\scantextokens{\\input{secret}}',
      '\\XeTeXpdffile{secret.pdf}',
      '$$',
      '',
      '$\\frac{1}{2}$.',
      '',
    ].join('\n');
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\begincsname');
    expect(next).not.toContain('\\UseName');
    expect(next).not.toContain('\\pdfextension');
    expect(next).not.toContain('\\ExplSyntaxOn');
    expect(next).not.toContain('\\scantextokens');
    expect(next).not.toContain('\\XeTeXpdffile');
    expect(next).not.toContain('\\input');
    expect(next).toContain('\\relax begincsname');
    expect(next).toContain('\\relax UseName');
    expect(next).toContain('\\frac{1}{2}');
  });

  it('turns a font load and a map file inside a formula into text', () => {
    const source = '$$\n\\pdfmapfile{secret.map}\n\\font\\x=secret\n$$\n\n$\\frac{1}{2}$ and $\\fontsize{10}{12}$.\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\pdfmapfile');
    expect(next).not.toContain('\\font\\x');
    expect(next).toContain('\\relax pdfmapfile');
    expect(next).toContain('\\relax font');
    expect(next).toContain('\\frac{1}{2}');
    expect(next).toContain('\\fontsize{10}{12}');
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

  it('turns a changed escape character inside a formula into text', () => {
    const source = [
      '$$',
      '\\catcode`|=0',
      '|input{secret.tex}',
      '\\lowercase{\\lccode`|=`\\\\}',
      '\\scantokens{x}',
      '$$',
      '',
      '$\\frac{1}{2}$.',
      '',
    ].join('\n');
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\catcode');
    expect(next).not.toContain('\\lowercase');
    expect(next).not.toContain('\\lccode');
    expect(next).not.toContain('\\scantokens');
    expect(next).toContain('\\relax catcode');
    expect(next).toContain('|input{secret.tex}');
    expect(next).toContain('\\frac{1}{2}');
  });

  it('turns an internal input and a file probe inside a formula into text', () => {
    const source = '$$\n\\makeatletter\n\\@input{secret}\n$$\n\n$\\IfFileExists{secret.tex}{yes}{no}$ and $\\frac{1}{2}$.\n';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\@input');
    expect(next).not.toContain('\\IfFileExists');
    expect(next).toContain('\\relax @input');
    expect(next).toContain('\\relax IfFileExists');
    expect(next).toContain('\\frac{1}{2}');
  });

  it('turns a pdfTeX file read and a filecontents block inside a formula into text', () => {
    const source = [
      '$$',
      '\\pdfobj file {secret}',
      '\\mdfivesum file {secret}',
      '\\begin{filecontents*}{secret.tex}',
      'hello',
      '\\end{filecontents*}',
      '$$',
      '',
      '$\\latelua{io.open("secret")}$ and $\\frac{1}{2}$.',
      '',
    ].join('\n');
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\pdfobj');
    expect(next).not.toContain('\\mdfivesum');
    expect(next).not.toContain('\\latelua');
    expect(next).not.toContain('\\begin{filecontents');
    expect(next).not.toContain('\\end{filecontents');
    expect(next).toContain('\\relax pdfobj');
    expect(next).toContain('\\relax mdfivesum');
    expect(next).toContain('\\relax latelua');
    expect(next).toContain('\\relax begin{filecontents}');
    expect(next).toContain('\\frac{1}{2}');
  });

  it('turns a spaced filecontents block inside a formula into text', () => {
    const source = '$$\n\\begin {filecontents}{secret.tex}\nhello\n\\end\n{filecontents}\n$$\n\n$$\n\\begin{aligned}\nx\n\\end{aligned}\n$$';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\begin {filecontents}');
    expect(next).not.toContain('\\end\n{filecontents}');
    expect(next).toContain('\\relax begin{filecontents}');
    expect(next).toContain('\\relax end{filecontents}');
    expect(next).toContain('\\begin{aligned}');
    expect(next).toContain('\\end{aligned}');
  });

  it('turns a commented filecontents name inside a formula into text', () => {
    const source = '$$\n\\begin%\n{filecontents*}{secret.tex}\nhello\n\\end % note\n{filecontents*}\n$$';
    const next = disarmFileReadsInMath(source);
    expect(next).not.toContain('\\begin%');
    expect(next).not.toContain('\\end %');
    expect(next).toContain('\\relax begin{filecontents}');
    expect(next).toContain('\\relax end{filecontents}');
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

describe('disarmPandocRawTex', () => {
  it('turns a file command in a raw TeX block into text and keeps a sample', () => {
    const source = [
      '```{=latex}',
      '\\input{secret.tex}',
      '```',
      '',
      '`\\openin\\x=secret`{=tex}',
      '',
      '```',
      '\\input{secret.tex}',
      '```',
      '',
      '```{=html}',
      '<b>keep</b>',
      '```',
      '',
    ].join('\n');
    const next = disarmPandocRawTex(source);
    const raw = next.slice(0, next.indexOf('```\n\\input{secret.tex}'));
    expect(raw).toContain('\\relax input');
    expect(raw).not.toContain('\\input');
    expect(raw).toContain('\\relax openin');
    expect(raw).not.toContain('\\openin');
    expect(next).toContain('```\n\\input{secret.tex}\n```');
    expect(next).toContain('<b>keep</b>');
  });
});
