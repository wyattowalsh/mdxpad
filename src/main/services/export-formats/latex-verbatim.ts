/** A verbatim sample that can contain the text `\end{verbatim}`. */
export function latexVerbatimLines(lines: readonly string[]): string[] {
  let name = 'verbatim';
  const body = lines.join('\n');
  let salt = 0;
  while (body.includes(`\\end{${name}}`)) {
    salt += 1;
    name = `mdxpadverb${salt}`;
  }
  if (name === 'verbatim') {
    return ['\\begin{verbatim}', ...lines, '\\end{verbatim}'];
  }
  return [
    '\\begingroup',
    '\\catcode`|=0 \\catcode`[=1 \\catcode`]=2',
    '\\catcode`\\{=12 \\catcode`\\}=12 \\catcode`\\\\=12',
    `|gdef|@x${name}#1\\end{${name}}[#1|end[${name}]]`,
    '\\endgroup',
    `\\def\\${name}{\\@verbatim\\frenchspacing\\@vobeyspaces\\@x${name}}`,
    `\\begin{${name}}`,
    ...lines,
    `\\end{${name}}`,
  ];
}
