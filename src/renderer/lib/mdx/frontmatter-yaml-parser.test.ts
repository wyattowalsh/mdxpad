import { describe, it, expect } from 'vitest';
import type { Root } from 'mdast';
import { parseFrontmatterYaml } from './frontmatter-yaml-parser';
import { extractOutline } from './outline-extractor';
import { parseFallbackOutline } from './fallback-outline-parser';

function rootWithYaml(value: string): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'yaml',
        value,
        position: {
          start: { line: 1, column: 1 },
          end: { line: value.split('\n').length + 2, column: 1 },
        },
      },
    ] as Root['children'],
  };
}

describe('parseFrontmatterYaml', () => {
  it('parses scalar and array values consistently', () => {
    const yaml = `title: "Shared Parser"
published: true
count: 7
price: 19.99
tags:
- mdx
- outline`;

    expect(parseFrontmatterYaml(yaml)).toEqual({
      title: 'Shared Parser',
      published: true,
      count: 7,
      price: 19.99,
      tags: ['mdx', 'outline'],
    });
  });

  it('is reused by both AST and fallback outline extraction paths', () => {
    const yaml = `title: "Shared Parser"
tags:
- one
- two`;
    const expected = parseFrontmatterYaml(yaml);

    const outlineFromAst = extractOutline(rootWithYaml(yaml));
    const outlineFromFallback = parseFallbackOutline(`---\n${yaml}\n---\n\n# Heading`);

    expect(outlineFromAst.frontmatter?.data).toEqual(expected);
    expect(outlineFromFallback.frontmatter?.data).toEqual(expected);
  });
});
