/**
 * Fallback Outline Parser Tests
 *
 * Tests for regex-based fallback parser used when MDX compilation fails.
 *
 * @module renderer/lib/mdx/fallback-outline-parser.test
 */

import { describe, it, expect } from 'vitest';
import { parseFallbackOutline, hasOutlineContent } from './fallback-outline-parser';

describe('parseFallbackOutline', () => {
  describe('empty and minimal documents', () => {
    it('should return empty outline for empty string', () => {
      const outline = parseFallbackOutline('');

      expect(outline.headings).toEqual([]);
      expect(outline.components).toEqual([]);
      expect(outline.frontmatter).toBeNull();
    });

    it('should return empty outline for whitespace-only', () => {
      const outline = parseFallbackOutline('   \n\n\t\t\n   ');

      expect(outline.headings).toEqual([]);
      expect(outline.components).toEqual([]);
      expect(outline.frontmatter).toBeNull();
    });

    it('should return empty outline for plain text', () => {
      const outline = parseFallbackOutline('Just some plain text\nwith multiple lines');

      expect(outline.headings).toEqual([]);
      expect(outline.components).toEqual([]);
      expect(outline.frontmatter).toBeNull();
    });
  });

  describe('heading extraction', () => {
    it('should extract a single h1 heading', () => {
      const outline = parseFallbackOutline('# Hello World');

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]).toEqual({
        depth: 1,
        text: 'Hello World',
        position: { line: 1, column: 1 },
      });
    });

    it('should extract headings at all levels (h1-h6)', () => {
      const source = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

      const outline = parseFallbackOutline(source);

      expect(outline.headings).toHaveLength(6);
      expect(outline.headings.map((h) => h.depth)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(outline.headings.map((h) => h.text)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    });

    it('should extract multiple headings with correct positions', () => {
      const source = `# First

Some paragraph text.

## Second

More content here.

### Third`;

      const outline = parseFallbackOutline(source);

      expect(outline.headings).toHaveLength(3);
      expect(outline.headings[0]?.position.line).toBe(1);
      expect(outline.headings[1]?.position.line).toBe(5);
      expect(outline.headings[2]?.position.line).toBe(9);
    });

    it('should handle trailing whitespace in headings', () => {
      const outline = parseFallbackOutline('# Title with spaces   ');

      expect(outline.headings[0]?.text).toBe('Title with spaces');
    });

    it('should handle headings with inline formatting markers', () => {
      const source = `# Title with **bold**
## And *italic* text
### Code: \`inline\``;

      const outline = parseFallbackOutline(source);

      expect(outline.headings.map((h) => h.text)).toEqual([
        'Title with **bold**',
        'And *italic* text',
        'Code: `inline`',
      ]);
    });

    it('should skip empty headings', () => {
      const source = `#
## Valid Heading
###    `;

      const outline = parseFallbackOutline(source);

      // Only the valid heading with actual text is extracted
      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Valid Heading');
    });

    it('should not match # without space', () => {
      const source = `#NoSpace
#Also not a heading
# Real Heading`;

      const outline = parseFallbackOutline(source);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Real Heading');
    });

    it('should not match more than 6 hashes', () => {
      const source = `####### Too many
# Valid`;

      const outline = parseFallbackOutline(source);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Valid');
    });
  });

  describe('component extraction', () => {
    it('should extract a single JSX component', () => {
      const outline = parseFallbackOutline('<Button>Click me</Button>');

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]).toEqual({
        name: 'Button',
        position: { line: 1, column: 1 },
      });
    });

    it('should extract self-closing components', () => {
      const outline = parseFallbackOutline('<Icon name="star" />');

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('Icon');
    });

    it('should extract multiple components', () => {
      const source = `<Header />
<Main>content</Main>
<Footer />`;

      const outline = parseFallbackOutline(source);

      expect(outline.components).toHaveLength(3);
      expect(outline.components.map((c) => c.name)).toEqual(['Header', 'Main', 'Footer']);
    });

    it('should extract components with attributes', () => {
      const outline = parseFallbackOutline('<Card title="Test" variant="primary" onClick={handler}>');

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('Card');
    });

    it('should extract nested components', () => {
      const source = `<Outer>
  <Inner />
</Outer>`;

      const outline = parseFallbackOutline(source);

      expect(outline.components).toHaveLength(2);
      expect(outline.components.map((c) => c.name)).toEqual(['Outer', 'Inner']);
    });

    it('should only match PascalCase components', () => {
      const source = `<div>not a component</div>
<span>also not</span>
<Component>real component</Component>`;

      const outline = parseFallbackOutline(source);

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('Component');
    });

    it('should handle components with numbers in name', () => {
      const outline = parseFallbackOutline('<Button2 /><Card3D />');

      expect(outline.components).toHaveLength(2);
      expect(outline.components.map((c) => c.name)).toEqual(['Button2', 'Card3D']);
    });

    it('should not duplicate components at same position', () => {
      // Edge case: regex might match same component twice
      const outline = parseFallbackOutline('<Card><Card>');

      // Should have 2 components at different positions
      expect(outline.components).toHaveLength(2);
    });

    it('should track component positions correctly', () => {
      const source = `Line 1
<First />
Line 3
<Second />`;

      const outline = parseFallbackOutline(source);

      expect(outline.components[0]?.position).toEqual({ line: 2, column: 1 });
      expect(outline.components[1]?.position).toEqual({ line: 4, column: 1 });
    });
  });

  describe('frontmatter extraction', () => {
    it('should extract simple frontmatter', () => {
      const source = `---
title: Hello World
date: 2024-01-15
---

# Content`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter).not.toBeNull();
      expect(outline.frontmatter?.data).toEqual({
        title: 'Hello World',
        date: '2024-01-15',
      });
    });

    it('should track frontmatter end line', () => {
      const source = `---
title: Test
author: Jane
---
# Heading`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.endLine).toBe(4);
    });

    it('should parse boolean values', () => {
      const source = `---
published: true
draft: false
---`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.data).toEqual({
        published: true,
        draft: false,
      });
    });

    it('should parse integer values', () => {
      const source = `---
count: 42
negative: -10
---`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.data).toEqual({
        count: 42,
        negative: -10,
      });
    });

    it('should parse float values', () => {
      const source = `---
price: 19.99
rate: -0.5
---`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.data).toEqual({
        price: 19.99,
        rate: -0.5,
      });
    });

    it('should parse array values', () => {
      const source = `---
tags:
- typescript
- react
- mdx
---`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.data.tags).toEqual(['typescript', 'react', 'mdx']);
    });

    it('should strip quotes from string values', () => {
      const source = `---
title: "Quoted Title"
single: 'Single Quoted'
---`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.data).toEqual({
        title: 'Quoted Title',
        single: 'Single Quoted',
      });
    });

    it('should not extract headings from frontmatter', () => {
      const source = `---
title: # Not a heading
---
# Real Heading`;

      const outline = parseFallbackOutline(source);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Real Heading');
    });

    it('should not extract components from frontmatter', () => {
      const source = `---
description: "<Component> in text"
---
<RealComponent />`;

      const outline = parseFallbackOutline(source);

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('RealComponent');
    });

    it('should handle empty frontmatter', () => {
      const source = `---

---
# Content`;

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter).not.toBeNull();
      expect(outline.frontmatter?.data).toEqual({});
    });
  });

  describe('combined extraction', () => {
    it('should extract headings, components, and frontmatter together', () => {
      const source = `---
title: My Document
tags:
- mdx
- outline
---

# Introduction

Some text.

<Callout type="info">
Important info
</Callout>

## Details

<CodeBlock language="typescript">
const x = 1;
</CodeBlock>`;

      const outline = parseFallbackOutline(source);

      // Check frontmatter
      expect(outline.frontmatter?.data).toEqual({
        title: 'My Document',
        tags: ['mdx', 'outline'],
      });

      // Check headings
      expect(outline.headings).toHaveLength(2);
      expect(outline.headings.map((h) => h.text)).toEqual(['Introduction', 'Details']);

      // Check components
      expect(outline.components).toHaveLength(2);
      expect(outline.components.map((c) => c.name)).toEqual(['Callout', 'CodeBlock']);
    });

    it('should handle malformed MDX gracefully', () => {
      const source = `# Title

<unclosed
  some broken JSX

## Still works

<ValidComponent />

<another broken="attribute`;

      const outline = parseFallbackOutline(source);

      // Should still extract valid headings
      expect(outline.headings).toHaveLength(2);
      expect(outline.headings.map((h) => h.text)).toEqual(['Title', 'Still works']);

      // Should extract valid-looking PascalCase component (lowercase tags are ignored)
      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('ValidComponent');
    });
  });

  describe('CRLF line endings', () => {
    it('should handle Windows-style line endings', () => {
      const source = '---\r\ntitle: Test\r\n---\r\n\r\n# Heading\r\n\r\n<Component />';

      const outline = parseFallbackOutline(source);

      expect(outline.frontmatter?.data.title).toBe('Test');
      expect(outline.headings).toHaveLength(1);
      expect(outline.components).toHaveLength(1);
    });
  });
});

describe('hasOutlineContent', () => {
  it('should return false for empty string', () => {
    expect(hasOutlineContent('')).toBe(false);
  });

  it('should return false for very short strings', () => {
    expect(hasOutlineContent('ab')).toBe(false);
  });

  it('should return false for plain text', () => {
    expect(hasOutlineContent('Just plain text without any markers')).toBe(false);
  });

  it('should return true for content with #', () => {
    expect(hasOutlineContent('# Heading')).toBe(true);
  });

  it('should return true for content with <', () => {
    expect(hasOutlineContent('<Component />')).toBe(true);
  });

  it('should return true for content starting with ---', () => {
    expect(hasOutlineContent('---\ntitle: Test\n---')).toBe(true);
  });

  it('should return true for mixed content', () => {
    expect(hasOutlineContent('Some text # not at start')).toBe(true);
  });
});
