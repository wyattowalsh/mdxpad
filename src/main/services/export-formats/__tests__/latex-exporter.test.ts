import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LatexExporter } from '../latex-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  lstat: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe('LatexExporter', () => {
  let exporter: LatexExporter;

  beforeEach(() => {
    exporter = new LatexExporter();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('latex');
    expect(exporter.label).toBe('LaTeX');
    expect(exporter.extension).toBe('tex');
    expect(exporter.mimeType).toBe('application/x-latex');
  });

  it('keeps a wrapped code fence inside the quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> ```\ncode\n```\n\nafter\n',
      outputPath: '/tmp/quote-fence.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const body = written.split('\\begin{document}')[1] ?? '';
    const quote = body.slice(body.indexOf('\\begin{quote}'), body.indexOf('\\end{quote}'));
    expect(quote).toContain('\\begin{verbatim}');
    expect(quote).toContain('code');
    expect(quote).not.toContain('after');
    expect(body).toContain('after');
    expect(body.indexOf('after')).toBeGreaterThan(body.lastIndexOf('\\end{verbatim}'));
  });

  it('keeps a wrapped display formula inside the quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> $$\nx^2\n$$\n\nafter\n',
      outputPath: '/tmp/quote-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const body = written.split('\\begin{document}')[1] ?? '';
    expect(body).toContain('x^2');
    expect(body).toContain('after');
    expect(body).not.toContain('\\textasciicircum');
    expect(body.indexOf('after')).toBeGreaterThan(body.lastIndexOf('$$'));
  });

  it('closes a display formula before the next paragraph when code shows the delimiter', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$ use `$$` here $$\n\nNext words\n',
      outputPath: '/tmp/display-code.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const body = written.split('\\begin{document}')[1] ?? '';
    expect(body).toContain('use `$$` here');
    expect(body).toContain('Next words');
    expect(body.indexOf('Next words')).toBeGreaterThan(body.lastIndexOf('$$'));
  });

  it('keeps paragraphs apart inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '1. one\n\n   two\n\n   three\n\n2. four\n',
      outputPath: '/tmp/list-paragraphs.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const body = written.split('\\begin{document}')[1] ?? '';
    expect(body).toMatch(/\\item one\s+two\s+three\s+\\item four/);
    expect(body).not.toContain('two three');
    expect(body).not.toContain('one two');
  });

  it('leaves YAML metadata out of the document', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '---\ntitle: Hello\nauthor: Ada\n---\n\nBody text.\n',
      outputPath: '/tmp/frontmatter.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('Body text.');
    expect(written).not.toContain('title: Hello');
    expect(written).not.toContain('author: Ada');
  });

  it('keeps a formula after a literal backslash and a rule on a list marker', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'The value is \\\\$x^2$.\n\n1. ***\n still the item\n',
      outputPath: '/tmp/marker.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('$x^2$');
    expect(written).toContain('\\textbackslash{}');
    expect(written).not.toContain('\\$x');
    expect(written).toContain('\\rule{\\textwidth}{0.4pt}');
    expect(written).toContain('still the item');
    expect(written).not.toContain('***');
  });

  it('exports a basic document with preamble and body', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Hello\n\nWorld',
      title: 'Test Doc',
      author: 'Test Author',
      outputPath: '/tmp/test.tex',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe('/tmp/test.tex');
    expect(writeFile).toHaveBeenCalledOnce();

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\documentclass');
    expect(written).toContain('\\begin{document}');
    expect(written).toContain('\\end{document}');
    expect(written).toContain('\\title{Test Doc}');
    expect(written).toContain('\\author{Test Author}');
    expect(written).toContain('\\section{');
  });

  it('does not let a formula read a local file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '$$\n\\input{secret.tex}\n$$\n\nSee $\\include{secret}$ and $\\frac{1}{2}$.\n\n$$\n\\@@input{secret}\n$$\n',
      outputPath: '/tmp/math-file.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).not.toContain('\\input');
    expect(written).not.toContain('\\@@input');
    expect(written).not.toContain('\\include');
    expect(written).toContain('\\relax input');
    expect(written).toContain('\\frac{1}{2}');
  });

  it('uses the requested document class, font size, and packages', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Hello',
      outputPath: '/tmp/class.tex',
      metadata: {
        documentClass: 'report',
        fontSize: '12pt',
        packages: ['booktabs', 'graphicx}\\input{secret'],
      },
    });

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\documentclass[12pt]{report}');
    expect(written).toContain('\\usepackage{booktabs}');
    expect(written).not.toContain('input{secret}');
  });

  it('converts headings to correct LaTeX commands', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6',
      outputPath: '/tmp/headings.tex',
    };

    await exporter.export(options);

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\section{');
    expect(written).toContain('\\subsection{');
    expect(written).toContain('\\subsubsection{');
    expect(written).toContain('\\paragraph{');
    expect(written).toContain('\\subparagraph{');
  });

  it('converts unordered lists to itemize', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '- Item A\n- Item B\n- Item C',
      outputPath: '/tmp/list.tex',
    };

    await exporter.export(options);

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{itemize}');
    expect(written).toContain('\\item');
    expect(written).toContain('\\end{itemize}');
  });

  it('keeps a hard break inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- Stay\\\n  put',
      outputPath: '/tmp/list-break.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\item Stay\\\\\nput');
  });

  it('strikes a list item across a hard break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- ~~hello  \n  world~~',
      outputPath: '/tmp/list-strike.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\item \\sout{hello}\\\\\n\\sout{world}');
  });

  it('keeps a setext heading inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n  ---\n  after\n',
      outputPath: '/tmp/list-setext.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\subsection{item}');
    expect(written).not.toContain('\\noindent\\rule');
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps a horizontal rule inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  ---\n\n  after\n',
      outputPath: '/tmp/list-rule.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.indexOf('\\item item')).toBeLessThan(
      written.indexOf('\\noindent\\rule{\\textwidth}{0.4pt}')
    );
    expect(written.indexOf('\\noindent\\rule{\\textwidth}{0.4pt}')).toBeLessThan(
      written.indexOf('after')
    );
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps indented code inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n      const x = 1\n\n  after\n',
      outputPath: '/tmp/list-indent.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.indexOf('\\item item')).toBeLessThan(written.indexOf('\\begin{verbatim}'));
    expect(written).toContain('const x = 1');
    expect(written).not.toContain('  const x = 1');
    expect(written.indexOf('\\end{verbatim}')).toBeLessThan(written.indexOf('after'));
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps display math inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  $$\n  a < b\n  $$\n\n  after\n',
      outputPath: '/tmp/list-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.indexOf('\\item item')).toBeLessThan(written.indexOf('$$\na < b\n$$'));
    expect(written).not.toContain('  a < b');
    expect(written.indexOf('$$\na < b\n$$')).toBeLessThan(written.indexOf('after'));
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps a table inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  | A | B |\n  | --- | ---: |\n  | 1 | 2 |\n\n  after\n',
      outputPath: '/tmp/list-table.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.indexOf('\\item item')).toBeLessThan(written.indexOf('\\begin{tabular}'));
    expect(written).toContain('A & B');
    expect(written).toContain('1 & 2');
    expect(written.indexOf('\\end{tabular}')).toBeLessThan(written.indexOf('after'));
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps a block quote inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  > quoted\n  > line\n\n  after\n',
      outputPath: '/tmp/list-quote.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.indexOf('\\item item')).toBeLessThan(written.indexOf('\\begin{quote}'));
    expect(written).toContain('quoted line');
    expect(written.indexOf('\\end{quote}')).toBeLessThan(written.indexOf('after'));
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps a fenced block inside a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  ```js\n  const x = 1\n  ```\n\n  after\n',
      outputPath: '/tmp/list-code.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.indexOf('\\item item')).toBeLessThan(written.indexOf('\\begin{verbatim}'));
    expect(written).toContain('const x = 1');
    expect(written.indexOf('\\begin{verbatim}')).toBeLessThan(written.indexOf('after'));
    expect(written.indexOf('after')).toBeLessThan(written.indexOf('\\end{itemize}'));
    expect(written).not.toContain('  const x = 1');
  });

  it('starts a new paragraph after a blank line in a list item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n\n  second\n  line\n',
      outputPath: '/tmp/list-paragraph.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\item item');
    expect(written).toContain('second line');
    expect(written).not.toContain('\\item item second');
    expect(written.indexOf('second line')).toBeLessThan(written.indexOf('\\end{itemize}'));
  });

  it('keeps a wrapped list item on the item line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n  continued',
      outputPath: '/tmp/list-wrap.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\item item continued');
  });

  it('keeps a formula that contains a link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See \\(x and [a \\)](https://example.com) y\\).',
      outputPath: '/tmp/linked-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('$x and $');
    expect(written).toContain('\\href{https://example.com}');
    expect(written).toContain('$ y$');
    expect(written).not.toContain('$x and [a');
  });

  it('links an image and keeps an email link single', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[![alt](a.png)](https://example.com)\n\n[ada@example.com](mailto:ada@example.com)',
      outputPath: '/tmp/image-link.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}');
    expect(written).toContain('\\includegraphics{a.png}');
    expect(written).not.toContain('](https://example.com)');
    expect(written).toContain('\\href{mailto:ada@example.com}{ada@example.com}');
    expect(written).not.toContain('\\href{mailto:ada@example.com}{\\href');
  });

  it('keeps a remote picture whose address uses a TeX special character', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: [
        '![shot](https://cdn.example/a.png?x=1&y=2)',
        '',
        '![hash](https://example.com/a#frag)',
        '',
        '![dollar](https://cdn.example/a$b.png)',
        '',
        '![local](pixel$1.png)',
      ].join('\n'),
      outputPath: '/tmp/remote-picture.tex',
      sourcePath: '/tmp/note.md',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\href{https://cdn.example/a.png?x=1&y=2}{shot}');
    expect(written).toContain('\\href{https://example.com/a#frag}{hash}');
    expect(written).toContain('\\href{https://cdn.example/a$b.png}{dollar}');
    expect(written).not.toContain('includegraphics{pixel$1.png}');
  });

  it('does not include a rooted picture whose description contains a bracket', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![foo [bar]](/etc/passwd)\n\n![Pixel](pixel.png)',
      outputPath: '/tmp/bracket-picture.tex',
      sourcePath: '/tmp/note.md',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('/etc/passwd');
    expect(written).not.toContain('includegraphics{/etc');
    expect(written).toContain('foo');
    expect(written).toContain('\\includegraphics{pixel.png}');
  });

  it('keeps a formula after a dollar sign glued to a word', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Path C:$foo and $x^2$.',
      outputPath: '/tmp/glued-dollar.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('C:\\$foo');
    expect(written).toContain('$x^2$');
    expect(written).not.toContain('textasciicircum');
  });

  it('keeps a formula after a dollar sign inside parentheses', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See (notes $a) and $x^2$.',
      outputPath: '/tmp/paren-dollar.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('(notes \\$a)');
    expect(written).toContain('$x^2$');
    expect(written).not.toContain('textasciicircum');
  });

  it('keeps a formula after a dollar sign in an email', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Mail ada$b@example.com and $x^2$.',
      outputPath: '/tmp/email-dollar.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\href{mailto:ada$b@example.com}{ada\\$b@example.com}');
    expect(written).toContain('$x^2$');
    expect(written).not.toContain('textasciicircum');
  });

  it('keeps a display formula that contains a link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See \\[x and [a](https://example.com) y\\].',
      outputPath: '/tmp/display-link.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('$x and $');
    expect(written).toContain('\\href{https://example.com}{a}');
    expect(written).toContain('$ y$');
    expect(written).not.toContain('$$');
  });

  it('keeps a formula after a dollar sign in an angle address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <https://example.com/a$b> and $x^2$.',
      outputPath: '/tmp/angle-dollar.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\href{https://example.com/a$b}{https://example.com/a\\$b}');
    expect(written).toContain('$x^2$');
    expect(written).not.toContain('textasciicircum');
  });

  it('keeps a formula after a dollar sign in a link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [the guide](https://example.com/a$b) and $x^2$.\n\nRead https://example.com/a$b and $x^2$.',
      outputPath: '/tmp/dollar-link.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\href{https://example.com/a$b}{the guide}');
    expect(written).toContain('\\href{https://example.com/a$b}');
    expect(written).toContain('$x^2$');
    expect(written).not.toContain('a$b and $x');
  });

  it('does not link a local file hidden behind a TeX comment', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<div>\n\n$$\n\\href%\n{file:///etc/passwd}{click}\n$$\n\n</div>\n',
      outputPath: '/tmp/comment-href.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).not.toContain('\\href');
    expect(written).toContain('\\relax href');
  });

  it('does not point a picture or link at a local file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: [
        '![Secret](/etc/passwd.png)',
        '',
        '[Disk](file:///etc/passwd)',
        '',
        '[Run](javascript:alert(1))',
        '',
        '![Pixel](pixel.png)',
        '',
        '<img src="file:///etc/passwd" alt="Secret">',
        '',
        '<a href="javascript:alert(1)">Run</a>',
        '',
        '<video poster="/etc/passwd.png"></video>',
      ].join('\n'),
      outputPath: '/tmp/local-file.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).not.toContain('/etc/passwd');
    expect(written).not.toContain('file:');
    expect(written).not.toContain('javascript:');
    expect(written).toContain('\\includegraphics{pixel.png}');
    expect(written).toContain('Secret');
    expect(written).toContain('Disk');
  });

  it('does not include a reference picture from outside the folder', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![Secret][x]\n\n[x]: /etc/passwd\n\n![Ok][y]\n\n[y]: pixel.png\n',
      outputPath: '/tmp/ref-picture.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('/etc/passwd');
    expect(written).not.toContain('includegraphics{/etc');
    expect(written).toContain('\\includegraphics{pixel.png}');
    expect(written).toContain('Secret');
  });

  it('does not compile a picture path that TeX would read as a command', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![Secret](^^5cinput{secret.png)\n\n![Pixel](pixel.png)',
      outputPath: '/tmp/tex-picture.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('^^');
    expect(written).not.toContain('\\input');
    expect(written).toContain('Secret');
    expect(written).toContain('\\includegraphics{pixel.png}');
  });

  it('does not let a caret escape in a formula read a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n^^5cinput{secret}\n$$\n\n$a^2$',
      outputPath: '/tmp/tex-caret.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('^^');
    expect(written).toContain('^{}5cinput');
    expect(written).toContain('$a^2$');
  });

  it('does not let a shell stream in a formula run a command', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n\\write18{cat secret}\n$$\n\n$\\frac{1}{2}$',
      outputPath: '/tmp/tex-write.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\write');
    expect(written).toContain('\\relax write18');
    expect(written).toContain('\\frac{1}{2}');
  });

  it('does not let a formula load a font or a map file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n\\pdfmapfile{secret.map}\n\\font\\x=secret\n$$\n\n$\\fontsize{10}{12}$',
      outputPath: '/tmp/tex-font.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\pdfmapfile');
    expect(written).not.toContain('\\font\\x');
    expect(written).toContain('\\relax pdfmapfile');
    expect(written).toContain('\\relax font');
    expect(written).toContain('\\fontsize{10}{12}');
  });

  it('does not let a constructed command name in a formula read a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '$$\n\\begincsname input\\endcsname{secret}\n\\UseName{input}{secret}\n\\pdfextension image file {secret.png}\n$$',
      outputPath: '/tmp/tex-constructed.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\begincsname');
    expect(written).not.toContain('\\UseName');
    expect(written).not.toContain('\\pdfextension');
    expect(written).toContain('\\relax begincsname');
    expect(written).toContain('\\relax UseName');
    expect(written).toContain('\\relax pdfextension');
  });

  it('does not let a changed escape character in a formula read a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n\\catcode`|=0\n|input{secret.tex}\n$$\n\n$\\frac{1}{2}$',
      outputPath: '/tmp/tex-catcode.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\catcode');
    expect(written).toContain('\\relax catcode');
    expect(written).toContain('|input{secret.tex}');
    expect(written).toContain('\\frac{1}{2}');
  });

  it('does not let an internal input in a formula read a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n\\makeatletter\n\\@input{secret}\n$$\n\n$\\IfFileExists{secret.tex}{yes}{no}$',
      outputPath: '/tmp/tex-at-input.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\@input');
    expect(written).not.toContain('\\IfFileExists');
    expect(written).toContain('\\relax @input');
    expect(written).toContain('\\relax IfFileExists');
  });

  it('does not let a pdfTeX object in a formula read a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '$$\n\\pdfobj file {secret}\n\\begin{filecontents}{secret.tex}\n\\end{filecontents}\n$$',
      outputPath: '/tmp/tex-pdfobj.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\pdfobj');
    expect(written).not.toContain('\\begin{filecontents');
    expect(written).toContain('\\relax pdfobj');
    expect(written).toContain('\\relax begin{filecontents}');
  });

  it('does not start filecontents when the name is on the next line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '$$\n\\begin\n{filecontents}{secret.tex}\nhello\n\\end {filecontents}\n$$\n\n$$\n\\begin{aligned}\nx\n\\end{aligned}\n$$',
      outputPath: '/tmp/tex-filecontents.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\begin\n{filecontents}');
    expect(written).not.toContain('\\end {filecontents}');
    expect(written).toContain('\\relax begin{filecontents}');
    expect(written).toContain('\\begin{aligned}');
  });

  it('does not start filecontents when a comment hides the name', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\n\\begin%\n{filecontents}{secret.tex}\nhello\n\\end%\n{filecontents}\n$$',
      outputPath: '/tmp/tex-filecontents-comment.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).not.toContain('\\begin%');
    expect(written).not.toContain('\\end%');
    expect(written).toContain('\\relax begin{filecontents}');
    expect(written).toContain('\\relax end{filecontents}');
  });

  it('keeps a backtick inside a longer code span', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Use `` a`b `` here',
      outputPath: '/tmp/code-span.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\texttt{a`b}');
  });

  it('formats an HTML emphasis tag', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Say <em>hello</em> now',
      outputPath: '/tmp/html-em.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\textit{hello}');
    expect(written).not.toContain('<em>');
  });

  it('breaks a line at an HTML break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See this.<br>Next',
      outputPath: '/tmp/html-break.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('this.');
    expect(written).toContain('\\newline');
    expect(written).toContain('Next');
    expect(written).not.toContain('<br');
  });

  it('keeps a nested empty marker in the item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- one\n  *\n',
      outputPath: '/tmp/nested-empty.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\item one');
    expect(written).toContain('*');
    expect(written).not.toContain('\\item[*]');
  });

  it('starts an ordered list at its written number', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '3. third',
      outputPath: '/tmp/start.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{enumerate}');
    expect(written).toContain('\\setcounter{enumi}{2}');
    expect(written).toContain('\\item third');
    await exporter.export({
      content: '1) one\n\n\n2) two\n\n0. zero',
      outputPath: '/tmp/paren-list.tex',
    });
    const continued = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(continued.match(/\\begin\{enumerate\}/g)).toHaveLength(2);
    expect(continued).toContain('\\item one');
    expect(continued).toContain('\\item two');
    expect(continued).toContain('\\setcounter{enumi}{-1}');
    expect(continued).toContain('\\item zero');
    await exporter.export({
      content: '1) one\n\n1. first\n\n+ plus\n* star',
      outputPath: '/tmp/paren-label.tex',
    });
    const labeled = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    const parenEnd = labeled.indexOf('\\end{enumerate}');
    expect(labeled.slice(0, parenEnd)).toContain('\\renewcommand{\\labelenumi}{\\theenumi)}');
    expect(labeled.slice(parenEnd)).not.toContain('\\renewcommand{\\labelenumi}');
    expect(labeled).toContain('\\item[+] plus');
    expect(labeled).toContain('\\item[*] star');
  });

  it('converts ordered lists to enumerate', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '1. First\n2. Second\n3. Third',
      outputPath: '/tmp/olist.tex',
    };

    await exporter.export(options);

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{enumerate}');
    expect(written).toContain('\\item');
    expect(written).toContain('\\end{enumerate}');
  });

  it('decodes a character reference outside code', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Say AT&amp;T.\n\n`AT&amp;T`',
      outputPath: '/tmp/entity.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('Say AT\\&T.');
    expect(written).toContain('\\texttt{AT\\&amp;T}');
  });

  it('labels a heading and links back to it', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '# Intro\n\nSee [the start](#intro).\n\n# Intro',
      outputPath: '/tmp/anchor.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\section{Intro}\\label{intro}');
    expect(written).toContain('\\hyperref[intro]{the start}');
    expect(written).toContain('\\label{intro-1}');
    expect(written).not.toContain('\\href{#intro}');
  });

  it('drops a closing hash run from a heading', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '# Title #\n\n# Hash#',
      outputPath: '/tmp/closing-hash.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\section{Title}');
    expect(written).toContain('\\section{Hash\\#}');
    expect(written).not.toContain('Title \\#');
  });

  it('keeps a formula inside a code span as code', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Use `$x$` here.',
      outputPath: '/tmp/code-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\texttt{\\$x\\$}');
    expect(written).not.toContain('\\texttt{$x$}');
  });

  it('keeps a tilde fence as verbatim', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '~~~\n# not a heading\n~~~',
      outputPath: '/tmp/tilde.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{verbatim}');
    expect(written).toContain('# not a heading');
    expect(written).not.toContain('\\section');
  });

  it('omits an HTML comment from the document', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <!-- secret --> this.',
      outputPath: '/tmp/comment.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('See');
    expect(written).toContain('this.');
    expect(written).not.toContain('secret');
    expect(written).not.toContain('<!--');
  });

  it('labels a fenced language above the verbatim block', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '```python\nprint(1)\n```',
      outputPath: '/tmp/code-lang.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\ttfamily python');
    expect(written).toContain('\\begin{verbatim}');
    expect(written).toContain('print(1)');
  });

  it('converts code blocks to verbatim', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '```\nconst x = 1;\n```',
      outputPath: '/tmp/code.tex',
    };

    await exporter.export(options);

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{verbatim}');
    expect(written).toContain('const x = 1;');
    expect(written).toContain('\\end{verbatim}');
  });

  it('keeps a verbatim end marker inside the code sample', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '```\n\\end{verbatim}\n# still code\n$notmath$\n```',
      outputPath: '/tmp/verbatim-end.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    const start = written.indexOf('\\begin{mdxpadverb1}');
    const end = written.lastIndexOf('\\end{mdxpadverb1}');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(written.indexOf('\\end{verbatim}')).toBeGreaterThan(start);
    expect(written.indexOf('# still code')).toBeGreaterThan(start);
    expect(written.indexOf('$notmath$')).toBeGreaterThan(start);
    expect(written.indexOf('$notmath$')).toBeLessThan(end);
  });

  it('converts inline formatting', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '**bold** and *italic* and `code` and [link](http://example.com)',
      outputPath: '/tmp/inline.tex',
    };

    await exporter.export(options);

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\textbf{bold}');
    expect(written).toContain('\\textit{italic}');
    expect(written).toContain('\\texttt{code}');
    expect(written).toContain('\\href{http://example.com}{link}');
  });

  it('emphasizes _words_ and keeps snake_case literal', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'use snake_case_name and _italic_',
      outputPath: '/tmp/underscore.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('snake\\_case\\_name');
    expect(written).toContain('\\textit{italic}');
    expect(written).not.toContain('\\textit{case}');
  });

  it('escapes LaTeX special characters', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: 'Price: $10 & 20%',
      outputPath: '/tmp/escape.tex',
    };

    await exporter.export(options);

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\$');
    expect(written).toContain('\\&');
    expect(written).toContain('\\%');
  });

  it('writes later footnotes as text superscripts', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'A[^1] B[^2] C[^3] D[^4]\n\n[^1]: one\n[^2]: two\n[^3]: three\n[^4]: four\n',
      outputPath: '/tmp/notes.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\textsuperscript{1}');
    expect(written).toContain('\\textsuperscript{4}');
    expect(written).not.toContain('⁴');
  });

  it('renders a formula that is a whole footnote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See[^1].\n\n[^1]: \\(x^2\\)\n',
      outputPath: '/tmp/note-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('$x^2$');
    expect(written).not.toContain('(x');
  });

  it('renders a formula in a link title', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[text](https://example.com "see \\(x\\)")\n',
      outputPath: '/tmp/title-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\textit{see $x$}');
  });

  it('strikes text wrapped onto the next line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '~~hello\nworld~~',
      outputPath: '/tmp/strike-wrap.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\sout{hello world}');
  });

  it('strikes text across a hard break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '~~hello  \nworld~~',
      outputPath: '/tmp/strike-break.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\sout{hello}\\\\');
    expect(written).toContain('\\sout{world}');
  });

  it('formats an HTML list, wrapper, and heading', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<ul><li>One</li><li>Two</li></ul>\n\n<div>Hello <b>there</b></div>\n\n<h1>A<br>B</h1>\n',
      outputPath: '/tmp/html-list.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\begin{itemize}');
    expect(written).toContain('\\item One');
    expect(written).toContain('\\item Two');
    expect(written).toContain('\\textbf{there}');
    expect(written).toContain('\\section{A B}');
    expect(written).not.toContain('<ul>');
    expect(written).not.toContain('<div>');
    expect(written).not.toContain('<h1');
  });

  it('formats a ruby reading beside its character', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<ruby>漢<rt>kan</rt></ruby>\n',
      outputPath: '/tmp/ruby.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('漢 (kan)');
    expect(written).not.toContain('<ruby>');
    expect(written).not.toContain('<rt>');
  });

  it('formats a quotation, a citation, and a time', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <q>quoted</q>, <cite>Title</cite>, and <time datetime="2020">then</time>\n',
      outputPath: '/tmp/html-roles.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('“quoted”');
    expect(written).toContain('\\textit{Title}');
    expect(written).toContain('then (2020)');
    expect(written).not.toContain('<q>');
    expect(written).not.toContain('<cite>');
    expect(written).not.toContain('<time');
  });

  it('raises and lowers HTML scripts', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'x<sup>y</sup> and a<sub>b</sub>\n',
      outputPath: '/tmp/scripts.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\textsuperscript{y}');
    expect(written).toContain('\\textsubscript{b}');
    expect(written).not.toContain('<sup>');
    expect(written).not.toContain('<sub>');
  });

  it('highlights and underlines HTML phrases', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <mark>hi</mark> and <u>there</u>.\n',
      outputPath: '/tmp/phrase.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\usepackage{xcolor}');
    expect(written).toContain('\\colorbox{yellow}{hi}');
    expect(written).toContain('\\uline{there}');
    expect(written).not.toContain('<mark>');
    expect(written).not.toContain('<u>');
  });

  it('strikes through deleted text', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Keep ~~gone~~.',
      outputPath: '/tmp/strike.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\sout{gone}');
  });

  it('keeps bold around a code span', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '**a `code` b** and **a `b**c` d** and **a ~~b~~ c**\n',
      outputPath: '/tmp/bold-code.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\textbf{a \\texttt{code} b}');
    expect(written).toContain('\\textbf{a \\texttt{b**c} d}');
    expect(written).toContain('\\textbf{a \\sout{b} c}');
  });

  it('strikes a code span and leaves tildes inside code', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See ~~`code`~~ and `~~not~~`.',
      outputPath: '/tmp/strike-code.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\sout{\\texttt{code}}');
    expect(written).toContain('\\texttt{');
    expect(written).toContain('\\textasciitilde{}');
    expect(written).not.toContain('\\sout{\\texttt{\\textasciitilde{}');
    expect(written).toContain('\\usepackage[normalem]{ulem}');
  });

  it('prints an image title beside the picture', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![Local](photo.jpg "Sunset")',
      outputPath: '/tmp/image-title.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\includegraphics{photo.jpg}');
    expect(written).toContain('Local');
    expect(written).toContain('\\textit{Sunset}');
  });

  it('includes a local image and links a remote one', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![Local](photo.jpg) and ![Remote](https://example.com/a.jpg)',
      outputPath: '/tmp/image.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\includegraphics{photo.jpg}');
    expect(written).toContain('Local');
    expect(written).toContain('\\href{https://example.com/a.jpg}{Remote}');
    expect(written).not.toContain('![');
  });

  it('nests a block quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> outer\n> > inner',
      outputPath: '/tmp/nested-quote.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const outer = written.indexOf('\\begin{quote}');
    const inner = written.indexOf('\\begin{quote}', outer + 1);
    expect(outer).toBeGreaterThan(-1);
    expect(inner).toBeGreaterThan(outer);
    expect(written.indexOf('inner')).toBeGreaterThan(inner);
    expect(written).not.toContain('> inner');
  });

  it('renders a block quote', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '> Keep this',
      outputPath: '/tmp/quote.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{quote}');
    expect(written).toContain('Keep this');
    expect(written).toContain('\\end{quote}');
  });

  it('keeps a later paragraph inside the parent item', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- parent\n\n  - child\n\n  more\n',
      outputPath: '/tmp/nested-more.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const childEnd = written.indexOf('\\end{itemize}');
    const more = written.indexOf('\nmore\n');
    const parentEnd = written.lastIndexOf('\\end{itemize}');
    expect(childEnd).toBeGreaterThan(written.indexOf('\\item child'));
    expect(more).toBeGreaterThan(childEnd);
    expect(parentEnd).toBeGreaterThan(more);
  });

  it('ends a nested list before a column-zero line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- parent\n\n  - child\n\nbaz\n',
      outputPath: '/tmp/nested-ended.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written.lastIndexOf('\\end{itemize}')).toBeLessThan(written.indexOf('\nbaz\n'));
  });

  it('nests a child list under its parent', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- parent\n  - child',
      outputPath: '/tmp/nested.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const parent = written.indexOf('\\item parent');
    const nested = written.indexOf('\\begin{itemize}', written.indexOf('\\begin{itemize}') + 1);
    const child = written.indexOf('\\item child');
    expect(parent).toBeGreaterThan(-1);
    expect(nested).toBeGreaterThan(parent);
    expect(child).toBeGreaterThan(nested);
    expect(written.indexOf('\\end{itemize}', child)).toBeGreaterThan(child);
  });

  it('keeps an escaped asterisk literal', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '\\*not italic\\*',
      outputPath: '/tmp/escape.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('*not italic*');
    expect(written).not.toContain('\\textit{not italic}');
  });

  it('links an autolink', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See <https://example.com> and https://example.com.',
      outputPath: '/tmp/auto.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}{https://example.com}');
    expect(written).toContain('}.');
  });

  it('keeps parentheses inside a link address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[wiki](https://en.wikipedia.org/wiki/Markdown_(markup))',
      outputPath: '/tmp/paren.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://en.wikipedia.org/wiki/Markdown_(markup)}{wiki}');
  });

  it('keeps parentheses inside an angle-bracket address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[docs](<https://en.wikipedia.org/wiki/Markdown_(markup_language)>)',
      outputPath: '/tmp/angle-paren.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain(
      '\\href{https://en.wikipedia.org/wiki/Markdown_(markup_language)}{docs}'
    );
    expect(written).not.toContain('[https://en.wikipedia.org');
  });

  it('keeps a numeric formula', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '\\(2\\) and \\(x\\)',
      outputPath: '/tmp/numeric-math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('${2}$');
    expect(written).toContain('$x$');
    expect(written).not.toContain('\\$2\\$');
  });

  it('keeps a spaced angle-bracket address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '[docs]( <https://example.com> )',
      outputPath: '/tmp/spaced-angle.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}{docs}');
    expect(written).not.toContain('[https://example.com]');
  });

  it('keeps a link title out of the address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [docs](https://example.com "Docs")',
      outputPath: '/tmp/title.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}{docs}');
    expect(written).toContain('\\textit{Docs}');
    expect(written).not.toContain('\\href{https://example.com "Docs"}');
  });

  it('resolves a reference link', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [the docs][guide].\n\n[guide]: https://example.com',
      outputPath: '/tmp/ref.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}{the docs}');
    expect(written).not.toContain('[guide]:');
  });

  it('joins a soft wrap and keeps a hard line break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Hello\nworld\n\nStay  \nput',
      outputPath: '/tmp/wrap.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('Hello world');
    expect(written).toContain('Stay\\\\');
    expect(written).toContain('put');
  });

  it('renders a setext heading', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Title\n---',
      outputPath: '/tmp/setext.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\subsection{Title}');
    expect(written).not.toContain('\\noindent\\rule');
  });

  it('renders a horizontal rule', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Above\n\n* * *\n\nBelow',
      outputPath: '/tmp/rule.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\noindent\\rule{\\textwidth}{0.4pt}');
    expect(written).toContain('Above');
    expect(written).not.toContain('* * *');
  });

  it('renders bold italic from three markers', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '***both*** and ___too___ and **bold *inner* text** and **[docs](https://example.com)** and [**docs**](https://example.com) and a * b * c and ***foo** bar*',
      outputPath: '/tmp/both.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\textit{\\textbf{both}}');
    expect(written).toContain('\\textit{\\textbf{foo} bar}');
    expect(written).toContain('\\textit{\\textbf{too}}');
    expect(written).toContain('a * b * c');
    expect(written).not.toContain('\\textit{ b }');
    expect(written).toContain('\\textbf{bold \\textit{inner} text}');
    expect(written).toContain('\\textbf{\\href{https://example.com}{docs}}');
    expect(written).toContain('\\href{https://example.com}{\\textbf{docs}}');
  });

  it('keeps code inside a link address label', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [a `b`](https://example.com) now\n',
      outputPath: '/tmp/code-link.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}{a \\texttt{b}}');
    expect(written).not.toContain('[a');
  });

  it('renders a task checkbox', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- [x] done\n- [ ] todo',
      outputPath: '/tmp/tasks.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\usepackage{amssymb}');
    expect(written).toContain('$\\boxtimes$ done');
    expect(written).toContain('$\\square$ todo');
    expect(written).not.toContain('[x]');
  });

  it('formats a definition list and a key', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '<dl><dt>Term</dt><dd>definition</dd></dl>\n\nPress <kbd>Cmd</kbd> and <ins>added</ins>\n',
      outputPath: '/tmp/html-definition.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\textbf{Term}');
    expect(written).toContain('definition');
    expect(written).toContain('\\texttt{Cmd}');
    expect(written).toContain('\\uline{added}');
    expect(written).not.toContain('<dl>');
    expect(written).not.toContain('<kbd>');
    expect(written).not.toContain('<ins>');
  });

  it('formats an HTML table', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '<table><tr><th>Name</th><th align="right">Amount</th></tr><tr><td>A | B</td><td>2</td></tr></table>\n',
      outputPath: '/tmp/html-table.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\begin{tabular}{lr}');
    expect(written).toContain('Name & Amount');
    expect(written).toContain('A | B & 2');
    expect(written).not.toContain('<table>');
  });

  it('renders a markdown table', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '| Name | Value |\n| --- | --- |\n| A | 1 |',
      outputPath: '/tmp/table.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{tabular}{ll}');
    expect(written).toContain('Name & Value');
    expect(written).toContain('A & 1');
  });

  it('aligns table columns and keeps an escaped pipe', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '| Item | Amount |\n| --- | ---: |\n| A \\| B | 2 |',
      outputPath: '/tmp/aligned-table.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\begin{tabular}{lr}');
    expect(written).toContain('A | B & 2');
  });

  it('keeps formulas and escapes prices', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See $x^2$ and $a + b$.\nPrices are $5 and $10.\n$$\nE = mc^2\n$$',
      outputPath: '/tmp/math.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('$x^2$');
    expect(written).toContain('$a + b$');
    expect(written).toContain('E = mc^2');
    expect(written).toContain('\\$5 and \\$10');
    await exporter.export({
      content: '$$\n100\\%\n$$\n\n$$100\\%\n$$',
      outputPath: '/tmp/display-percent.tex',
    });
    const display = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(display).toContain('$$\n100\\%\n$$');
    expect(display).not.toContain('\\$\\$');
    expect(written).not.toContain('\\$x');
    await exporter.export({
      content: 'Price is $5 & $6$.\n',
      outputPath: '/tmp/price-amp.tex',
    });
    const price = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(price).toContain('\\$5 \\& \\$6\\$');
    expect(price).not.toContain('$5 & $');
  });

  it('escapes a raw ampersand, hash, and percent inside display math', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content:
        '$$a & b$$\n\n$$a # b$$\n\n$$100%$$\n\n$$\n\\begin{aligned}\na & b\n\\end{aligned}\n$$',
      outputPath: '/tmp/math-specials.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('$$a \\& b$$');
    expect(written).toContain('$$a \\# b$$');
    expect(written).toContain('$$100\\%$$');
    expect(written).toContain('\\begin{aligned}\na & b\n\\end{aligned}');
    expect(written).not.toContain('a \\& b\n\\end{aligned}');
  });

  it('keeps an underscore inside text and a multline environment', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$\\text{hello_world}$$\n\n$$\\begin{multline}\na \\\\ b\n\\end{multline}$$',
      outputPath: '/tmp/text-underscore.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('\\text{hello\\_world}');
    expect(written).toContain('\\begin{multline}');
    expect(written).not.toContain('\\begin{gather}');
  });

  it('leaves the next paragraph in place when a formula never closes', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Text $$\n\nmore\n',
      outputPath: '/tmp/unclosed-display.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('Text \\$\\$');
    expect(written).toContain('\nmore\n');
    expect(written).not.toMatch(/\$\$\nmore/);
  });

  it('keeps a percent inside a display formula that looks like a price', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '$$50% off$$\n\nNext paragraph.\n',
      outputPath: '/tmp/display-percent-words.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string;
    expect(written).toContain('$$50\\% off$$');
    expect(written).toContain('Next paragraph.');
    expect(written).not.toContain('50%');
  });

  it('keeps a backslash as a LaTeX command', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Path C:\\temp and {braces}',
      outputPath: '/tmp/backslash.tex',
    });

    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\textbackslash{}');
    expect(written).not.toContain('\\textbackslash\\{\\}');
    expect(written).toContain('\\{braces\\}');
  });

  it('returns error result on write failure', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('disk full'));

    const result = await exporter.export({
      content: '# Test',
      outputPath: '/tmp/fail.tex',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('disk full');
  });
});
