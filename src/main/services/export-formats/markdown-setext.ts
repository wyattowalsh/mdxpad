/** A setext underline under a paragraph: `=` is heading 1 and `-` is heading 2. */
export function setextLevel(line: string): 1 | 2 | null {
  const match = /^( {0,3})(=+|-+)[ \t]*$/.exec(line);
  const marks = match?.[2];
  if (!marks) {
    return null;
  }
  return marks.startsWith('=') ? 1 : 2;
}
