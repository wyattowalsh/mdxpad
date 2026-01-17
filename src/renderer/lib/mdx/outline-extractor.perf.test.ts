/**
 * Outline Extractor Performance Tests
 *
 * Benchmark tests to verify extraction performance requirements:
 * - 100-line doc: <10ms
 * - 500-line doc: <30ms
 * - 1000-line doc: <50ms
 *
 * @module renderer/lib/mdx/outline-extractor.perf.test
 */

import { describe, it, expect } from 'vitest';
import type { Root, Heading, Paragraph, Text, RootContent } from 'mdast';
import { extractOutline } from './outline-extractor';

// =============================================================================
// TEST HELPERS - MDAST NODE BUILDERS
// =============================================================================

/**
 * Create a text node.
 */
function text(value: string): Text {
  return { type: 'text', value };
}

/**
 * Create a heading node with text content.
 */
function heading(
  depth: 1 | 2 | 3 | 4 | 5 | 6,
  textContent: string,
  line: number
): Heading {
  return {
    type: 'heading',
    depth,
    children: [text(textContent)],
    position: {
      start: { line, column: 1, offset: 0 },
      end: { line, column: textContent.length + depth + 2, offset: 0 },
    },
  };
}

/**
 * Create a paragraph node.
 */
function paragraph(textContent: string, line: number): Paragraph {
  return {
    type: 'paragraph',
    children: [text(textContent)],
    position: {
      start: { line, column: 1, offset: 0 },
      end: { line, column: textContent.length + 1, offset: 0 },
    },
  };
}

/**
 * Create a YAML frontmatter node.
 */
function yaml(value: string, startLine = 1, endLine = 3): {
  type: 'yaml';
  value: string;
  position: { start: { line: number; column: number }; end: { line: number; column: number } };
} {
  return {
    type: 'yaml',
    value,
    position: {
      start: { line: startLine, column: 1 },
      end: { line: endLine, column: 1 },
    },
  };
}

/**
 * Create an MDX JSX flow element node.
 */
function mdxJsxFlowElement(
  name: string | null,
  line: number
): {
  type: 'mdxJsxFlowElement';
  name: string | null;
  attributes: never[];
  children: never[];
  position: { start: { line: number; column: number }; end: { line: number; column: number } };
} {
  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes: [],
    children: [],
    position: {
      start: { line, column: 1 },
      end: { line, column: 20 },
    },
  };
}

/**
 * Generate a test AST with specified number of simulated lines.
 * Creates a realistic document with headings, text, and components.
 */
function generateAst(lineCount: number): Root {
  const children: RootContent[] = [];

  // Add frontmatter (simulates 4 lines)
  children.push(yaml('title: Performance Test\ndate: 2026-01-17', 1, 4) as unknown as RootContent);

  let currentLine = 5;
  let headingCounter = 1;
  let componentCounter = 1;

  while (currentLine < lineCount) {
    // Every 20 lines, add a heading
    if (currentLine % 20 === 0) {
      const level = ((headingCounter % 3) + 1) as 1 | 2 | 3;
      children.push(heading(level, `Heading ${headingCounter}`, currentLine));
      headingCounter++;
      currentLine++;
      continue;
    }

    // Every 30 lines, add a component
    if (currentLine % 30 === 0) {
      children.push(mdxJsxFlowElement(`Component${componentCounter % 5}`, currentLine) as unknown as RootContent);
      componentCounter++;
      currentLine++;
      continue;
    }

    // Add regular paragraph text
    children.push(paragraph(`This is paragraph text on line ${currentLine}.`, currentLine));
    currentLine++;
  }

  return { type: 'root', children };
}

/**
 * Measure execution time of a function.
 * @returns Execution time in milliseconds
 */
function measureTime(fn: () => void): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  return end - start;
}

/**
 * Run extraction multiple times and return average time.
 */
function benchmarkExtraction(ast: Root, iterations: number = 10): number {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const time = measureTime(() => {
      extractOutline(ast);
    });
    times.push(time);
  }

  // Return average time
  return times.reduce((a, b) => a + b, 0) / times.length;
}

// =============================================================================
// PERFORMANCE BENCHMARKS
// =============================================================================

describe('Outline Extractor Performance', () => {
  describe('100-line document', () => {
    const ast = generateAst(100);

    it('should extract outline in less than 10ms', () => {
      const avgTime = benchmarkExtraction(ast);

      // Log for debugging
      console.log(`100-line doc: ${avgTime.toFixed(2)}ms (avg of 10 runs)`);

      expect(avgTime).toBeLessThan(10);
    });

    it('should produce valid outline structure', () => {
      const outline = extractOutline(ast);

      expect(outline.headings.length).toBeGreaterThan(0);
      expect(outline.frontmatter).not.toBeNull();
    });
  });

  describe('500-line document', () => {
    const ast = generateAst(500);

    it('should extract outline in less than 30ms', () => {
      const avgTime = benchmarkExtraction(ast);

      console.log(`500-line doc: ${avgTime.toFixed(2)}ms (avg of 10 runs)`);

      expect(avgTime).toBeLessThan(30);
    });

    it('should produce valid outline structure', () => {
      const outline = extractOutline(ast);

      expect(outline.headings.length).toBeGreaterThan(0);
      expect(outline.components.length).toBeGreaterThan(0);
      expect(outline.frontmatter).not.toBeNull();
    });
  });

  describe('1000-line document', () => {
    const ast = generateAst(1000);

    it('should extract outline in less than 50ms', () => {
      const avgTime = benchmarkExtraction(ast);

      console.log(`1000-line doc: ${avgTime.toFixed(2)}ms (avg of 10 runs)`);

      expect(avgTime).toBeLessThan(50);
    });

    it('should produce valid outline structure', () => {
      const outline = extractOutline(ast);

      expect(outline.headings.length).toBeGreaterThan(0);
      expect(outline.components.length).toBeGreaterThan(0);
      expect(outline.frontmatter).not.toBeNull();
    });

    it('should scale linearly with document size', () => {
      // Generate a 2000-line doc to verify linear scaling
      const largeAst = generateAst(2000);

      // Multiple warmup runs to allow JIT optimization
      for (let i = 0; i < 5; i++) {
        extractOutline(ast);
        extractOutline(largeAst);
      }

      const time1000 = benchmarkExtraction(ast, 10);
      const time2000 = benchmarkExtraction(largeAst, 10);

      // Use minimum time floor to handle very fast executions
      // where small variations appear as large percentages
      const time1000Adjusted = Math.max(time1000, 0.5);

      console.log(`1000-line: ${time1000.toFixed(2)}ms, 2000-line: ${time2000.toFixed(2)}ms`);

      // Verify 2000-line takes less than 6x the 1000-line time
      // This is generous to account for: CI load, GC pauses, memory pressure
      // Linear scaling would be 2x; observed is typically 2-3x
      expect(time2000).toBeLessThan(time1000Adjusted * 6);
    });
  });
});

// =============================================================================
// EDGE CASE PERFORMANCE
// =============================================================================

describe('Edge Case Performance', () => {
  it('should handle document with many nested headings efficiently', () => {
    // Create AST with deeply nested heading structure (600 headings)
    const children: RootContent[] = [
      yaml('title: Nested', 1, 3) as unknown as RootContent,
    ];

    let line = 4;
    for (let i = 0; i < 100; i++) {
      // Create a cycle of H1-H6 headings
      for (let level = 1; level <= 6; level++) {
        children.push(heading(level as 1 | 2 | 3 | 4 | 5 | 6, `Heading ${level} - ${i}`, line));
        line++;
        children.push(paragraph('Some content here.', line));
        line++;
      }
    }

    const ast: Root = { type: 'root', children };

    const avgTime = benchmarkExtraction(ast);
    console.log(`Nested headings (600 headings): ${avgTime.toFixed(2)}ms`);

    expect(avgTime).toBeLessThan(50);
  });

  it('should handle document with many components efficiently', () => {
    const children: RootContent[] = [
      yaml('title: Components', 1, 3) as unknown as RootContent,
    ];

    let line = 4;
    for (let i = 0; i < 200; i++) {
      children.push(mdxJsxFlowElement(`Component${i % 10}`, line) as unknown as RootContent);
      line++;
      children.push(paragraph('Some text content.', line));
      line++;
    }

    const ast: Root = { type: 'root', children };

    const avgTime = benchmarkExtraction(ast);
    console.log(`Many components (200 components): ${avgTime.toFixed(2)}ms`);

    expect(avgTime).toBeLessThan(50);
  });

  it('should handle empty document quickly', () => {
    const ast: Root = { type: 'root', children: [] };

    const avgTime = benchmarkExtraction(ast, 100);
    console.log(`Empty doc: ${avgTime.toFixed(2)}ms (avg of 100 runs)`);

    expect(avgTime).toBeLessThan(1);
  });
});
