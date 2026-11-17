import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LatexExporter } from '../latex-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
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

  it('keeps a wrapped list item on the item line', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '- item\n  continued',
      outputPath: '/tmp/list-wrap.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\item item continued');
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

  it('strikes through deleted text', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Keep ~~gone~~.',
      outputPath: '/tmp/strike.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\sout{gone}');
    expect(written).toContain('\\usepackage[normalem]{ulem}');
  });

  it('includes a local image and links a remote one', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: '![Local](photo.jpg) and ![Remote](https://example.com/a.jpg)',
      outputPath: '/tmp/image.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\includegraphics{photo.jpg}');
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
    expect(written).toContain('\\href{https://en.wikipedia.org/wiki/Markdown\\_(markup)}{wiki}');
  });

  it('keeps a link title out of the address', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'See [docs](https://example.com "Docs")',
      outputPath: '/tmp/title.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\href{https://example.com}{docs}');
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

  it('keeps a hard line break', async () => {
    const { writeFile } = await import('node:fs/promises');
    await exporter.export({
      content: 'Hello\nworld\n\nStay  \nput',
      outputPath: '/tmp/wrap.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('Hello\nworld');
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
        '***both*** and ___too___ and **bold *inner* text** and **[docs](https://example.com)** and [**docs**](https://example.com)',
      outputPath: '/tmp/both.tex',
    });
    const written = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(written).toContain('\\textbf{\\textit{both}}');
    expect(written).toContain('\\textbf{\\textit{too}}');
    expect(written).toContain('\\textbf{bold \\textit{inner} text}');
    expect(written).toContain('\\textbf{\\href{https://example.com}{docs}}');
    expect(written).toContain('\\href{https://example.com}{\\textbf{docs}}');
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
    expect(written).not.toContain('\\$x');
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
