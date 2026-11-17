/** A CommonMark thematic break, including spaced markers such as `* * *`. */
export function isThematicBreak(line: string): boolean {
  return /^([-*_])(?:\s*\1){2,}\s*$/.test(line.trim());
}
