/**
 * Text Statistics Utilities
 *
 * Pure utility functions for computing word count, character count,
 * and estimated reading time from text content.
 *
 * @module renderer/lib/text-stats
 */

// CJK Unified Ideographs range
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
// Word boundary pattern for non-CJK text
const WORD_REGEX = /[^\s]+/g;
const FRONTMATTER_BLOCK = /^---\r?\n[\s\S]*?\r?\n---/;

/** Drop a leading YAML frontmatter block so counts cover the document body. */
export function documentBody(text: string): string {
  const match = FRONTMATTER_BLOCK.exec(text);
  if (!match) {
    return text;
  }
  return text.slice(match[0].length).replace(/^\r?\n/, '');
}

/**
 * Keep the words a reader sees.
 * Frontmatter, fenced code, marker characters, and link addresses are left out.
 */
export function countableProse(text: string): string {
  return documentBody(text)
    .replace(/^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]{0,3}\1[ \t]*$/gm, '\n')
    .replace(/!\[([^\]]*)]\([^)\n]*\)/g, '$1')
    .replace(/\[([^\]]*)]\([^)\n]*\)/g, '$1')
    .replace(/\[([^\]]*)]\[[^\]\n]*]/g, '$1')
    .replace(/^[ \t]*\[[^\]]+]:[ \t]+\S+.*$/gm, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}(?:>[ \t]?)+/gm, '')
    .replace(/^[ \t]{0,3}[-*+][ \t]+\[[ xX]][ \t]+/gm, '')
    .replace(/^[ \t]{0,3}[-*+][ \t]+/gm, '')
    .replace(/^[ \t]{0,3}\d+[.)][ \t]+/gm, '')
    .replace(/^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '');
}

/**
 * Count the number of words in text.
 * Handles Latin scripts (whitespace-separated) and CJK characters (each character = 1 word).
 *
 * @param text - The text to count words in
 * @returns Number of words
 */
export function countWords(text: string): number {
  if (text.length === 0) return 0;

  // Count CJK characters (each is considered a word)
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Remove CJK characters then count whitespace-separated words
  const withoutCjk = text.replace(CJK_REGEX, ' ');
  const wordMatches = withoutCjk.match(WORD_REGEX);
  const wordCount = wordMatches ? wordMatches.length : 0;

  return wordCount + cjkCount;
}

/**
 * Count the number of characters in text (excluding whitespace).
 *
 * @param text - The text to count characters in
 * @returns Number of non-whitespace characters
 */
export function countCharacters(text: string): number {
  if (text.length === 0) return 0;
  return text.replace(/\s/g, '').length;
}

/**
 * Estimate reading time based on word count.
 *
 * @param text - The text to estimate reading time for
 * @param wpm - Words per minute (default: 200)
 * @returns Object with minutes and seconds
 */
export function estimateReadingTime(text: string, wpm = 200): { minutes: number; seconds: number } {
  const words = countWords(text);
  const totalSeconds = Math.ceil((words / wpm) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
}
