import { describe, it, expect } from 'vitest';

import { analyzeMarkdownIntelligence, collectAnchorCompletions } from './markdown-intelligence';

describe('analyzeMarkdownIntelligence', () => {
  it('drops a closing hash run from the heading label', () => {
    const result = analyzeMarkdownIntelligence('# Intro #\n# Hash#');
    expect(result.headings.map((heading) => heading.text)).toEqual(['Intro', 'Hash#']);
    expect(result.headings.map((heading) => heading.slug)).toEqual(['intro', 'hash']);
  });

  it('extracts headings with stable anchor slugs', () => {
    const result = analyzeMarkdownIntelligence('# Intro\n## Details\n# Intro');

    expect(result.headings.map((heading) => heading.slug)).toEqual(['intro', 'details', 'intro-1']);
  });

  it('reports missing heading anchors in markdown links', () => {
    const result = analyzeMarkdownIntelligence(
      '# Intro\n\n[good](#intro)\n[bad](#missing-section)'
    );

    expect(
      result.diagnostics.some((diagnostic) => diagnostic.message.includes('#missing-section'))
    ).toBe(true);
  });

  it('accepts a heading link written with the title capitals or spaces', () => {
    const result = analyzeMarkdownIntelligence(
      '# Two\n\n# Hello World\n\n[two](#Two)\n[hello](#Hello World)'
    );

    expect(result.links.map((link) => link.target)).toEqual(['#Two', '#Hello World']);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.message.includes('not found'))
    ).toEqual([]);
  });

  it('reports empty link targets', () => {
    const result = analyzeMarkdownIntelligence('[broken]()');

    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes('empty'))).toBe(
      true
    );
  });

  it('ignores heading and link syntax inside fenced code blocks', () => {
    const result = analyzeMarkdownIntelligence(
      '```md\n# fake heading\n[fake](#missing)\n```\n\n# real heading'
    );

    expect(result.headings).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('collectAnchorCompletions', () => {
  it('returns heading anchor completions filtered by prefix', () => {
    const completions = collectAnchorCompletions('# Alpha\n## Beta\n## Build Pipeline', 'b');

    expect(completions.map((completion) => completion.apply)).toEqual(['#beta', '#build-pipeline']);
  });
});
