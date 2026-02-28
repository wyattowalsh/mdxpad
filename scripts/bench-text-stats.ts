/**
 * Text Statistics Benchmark
 *
 * Measures text statistics computation performance:
 * - Word count on 50KB document
 * - Character count on 50KB document
 * - Reading time estimation on 50KB document
 *
 * Target: < 20ms for each operation.
 *
 * @module scripts/bench-text-stats
 */

import { runBenchmarkSuite } from './bench-harness';
import { countWords, countCharacters, estimateReadingTime } from '../src/renderer/lib/text-stats';

// =============================================================================
// TEST DATA GENERATION
// =============================================================================

const TARGET_SIZE_KB = 50;

/**
 * Generate a realistic text document mixing Latin and CJK characters.
 */
function generateText(targetBytes: number): string {
  const parts: string[] = [];
  let currentSize = 0;

  const latinParagraphs = [
    'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet at least once. Performance benchmarks help us ensure that our text processing remains fast even with large documents.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'MDX combines the best of Markdown and JSX, allowing you to write interactive documents with embedded components. This makes it ideal for documentation, blog posts, and educational content.',
    'TypeScript strict mode catches many common errors at compile time, reducing runtime bugs and improving code quality. Combined with Zod validation, it provides end-to-end type safety.',
  ];

  // Some CJK text to exercise the CJK word counting path
  const cjkParagraphs = [
    '\u8fd9\u662f\u4e00\u6bb5\u4e2d\u6587\u6d4b\u8bd5\u6587\u672c\uff0c\u7528\u4e8e\u6d4b\u8bd5CJK\u5b57\u7b26\u8ba1\u6570\u529f\u80fd\u3002\u6bcf\u4e2a\u6c49\u5b57\u90fd\u88ab\u8ba1\u7b97\u4e3a\u4e00\u4e2a\u5355\u8bcd\u3002',
    '\u65e5\u672c\u8a9e\u306e\u30c6\u30b9\u30c8\u30c6\u30ad\u30b9\u30c8\u3082\u542b\u3081\u3066\u3001\u591a\u8a00\u8a9e\u5bfe\u5fdc\u3092\u78ba\u8a8d\u3057\u307e\u3059\u3002',
  ];

  let idx = 0;
  while (currentSize < targetBytes) {
    // Alternate between Latin and CJK content
    const isLatin = idx % 5 !== 0;
    const para = isLatin
      ? (latinParagraphs[idx % latinParagraphs.length] ?? '')
      : (cjkParagraphs[idx % cjkParagraphs.length] ?? '');

    parts.push(para);
    parts.push('\n\n');
    currentSize += para.length + 2;
    idx++;
  }

  return parts.join('');
}

/**
 * Generate pure Latin text (worst case for word boundary regex).
 */
function generateLatinOnly(targetBytes: number): string {
  const words =
    'the quick brown fox jumps over lazy dog performance benchmark text statistics'.split(' ');
  const parts: string[] = [];
  let currentSize = 0;

  while (currentSize < targetBytes) {
    for (const word of words) {
      parts.push(word);
      parts.push(' ');
      currentSize += word.length + 1;
      if (currentSize >= targetBytes) break;
    }
    parts.push('\n');
    currentSize++;
  }

  return parts.join('');
}

// =============================================================================
// BENCHMARK
// =============================================================================

const mixedText50kb = generateText(TARGET_SIZE_KB * 1024);
const latinText50kb = generateLatinOnly(TARGET_SIZE_KB * 1024);

console.error(`Mixed text size: ${(mixedText50kb.length / 1024).toFixed(1)}KB`);
console.error(`Latin text size: ${(latinText50kb.length / 1024).toFixed(1)}KB`);

runBenchmarkSuite('Text Statistics', [
  {
    name: `countWords on ${TARGET_SIZE_KB}KB mixed (Latin + CJK)`,
    thresholdMs: 20,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      countWords(mixedText50kb);
    },
  },
  {
    name: `countWords on ${TARGET_SIZE_KB}KB Latin-only`,
    thresholdMs: 20,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      countWords(latinText50kb);
    },
  },
  {
    name: `countCharacters on ${TARGET_SIZE_KB}KB mixed`,
    thresholdMs: 20,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      countCharacters(mixedText50kb);
    },
  },
  {
    name: `estimateReadingTime on ${TARGET_SIZE_KB}KB mixed`,
    thresholdMs: 20,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      estimateReadingTime(mixedText50kb);
    },
  },
  {
    name: `All stats combined on ${TARGET_SIZE_KB}KB mixed`,
    thresholdMs: 20,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      countWords(mixedText50kb);
      countCharacters(mixedText50kb);
      estimateReadingTime(mixedText50kb);
    },
  },
]).catch((err: unknown) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
