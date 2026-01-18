/**
 * Template Parser Library Tests
 *
 * Feature: 016-template-library
 */

import { describe, it, expect } from 'vitest';
import {
  parseTemplate,
  parseTemplateMetadata,
  TemplateParseError,
} from './template-parser';

const VALID_TEMPLATE = `---
name: "Blog Post"
description: "A standard blog post template"
category: "blog"
tags:
  - blog
  - article
author: "mdxpad"
version: "1.0.0"
variables:
  - name: "title"
    description: "Post title"
    default: "Untitled"
  - name: "author_name"
    required: true
---

# {{title}}

By {{author_name}} | {{date}}

Your content here...
`;

const MINIMAL_TEMPLATE = `---
name: "Minimal"
description: "A minimal template"
category: "notes"
---

# Hello World
`;

const INVALID_FRONTMATTER = `---
name: "Missing Category"
description: "This template has no category"
---

Content here
`;

const MALFORMED_YAML = `---
name: "Bad YAML
description: missing quote
---

Content
`;

describe('parseTemplate', () => {
  it('parses a valid template with all fields', () => {
    const template = parseTemplate('/path/to/blog-post.mdxt', VALID_TEMPLATE, true);

    expect(template.id).toBe('blog-post');
    expect(template.name).toBe('Blog Post');
    expect(template.description).toBe('A standard blog post template');
    expect(template.category).toBe('blog');
    expect(template.tags).toEqual(['blog', 'article']);
    expect(template.author).toBe('mdxpad');
    expect(template.version).toBe('1.0.0');
    expect(template.isBuiltIn).toBe(true);
    expect(template.filePath).toBe('/path/to/blog-post.mdxt');
    expect(template.variables).toHaveLength(2);
    expect(template.variables[0]?.name).toBe('title');
    expect(template.variables[1]?.required).toBe(true);
    expect(template.content).toContain('# {{title}}');
    expect(template.createdAt).toBeInstanceOf(Date);
    expect(template.updatedAt).toBeInstanceOf(Date);
  });

  it('parses a minimal template with defaults', () => {
    const template = parseTemplate('/templates/minimal.mdxt', MINIMAL_TEMPLATE, false);

    expect(template.id).toBe('minimal');
    expect(template.name).toBe('Minimal');
    expect(template.category).toBe('notes');
    expect(template.tags).toEqual([]);
    expect(template.variables).toEqual([]);
    expect(template.isBuiltIn).toBe(false);
    expect(template.version).toBe('1.0.0');
  });

  it('generates ID from slugified name when not provided', () => {
    const content = `---
name: "My Custom Template Name"
description: "Test description"
category: "custom"
---

Content
`;
    const template = parseTemplate('/path/to/file.mdxt', content, false);
    expect(template.id).toBe('my-custom-template-name');
  });

  it('uses provided ID when available', () => {
    const content = `---
id: "custom-id-123"
name: "Template Name"
description: "Test description"
category: "documentation"
---

Content
`;
    const template = parseTemplate('/path/to/file.mdxt', content, true);
    expect(template.id).toBe('custom-id-123');
  });

  it('throws TemplateParseError for invalid frontmatter', () => {
    expect(() => parseTemplate('/path/to/bad.mdxt', INVALID_FRONTMATTER, false))
      .toThrow(TemplateParseError);
  });

  it('throws TemplateParseError for malformed YAML', () => {
    expect(() => parseTemplate('/path/to/malformed.mdxt', MALFORMED_YAML, false))
      .toThrow(TemplateParseError);
  });

  it('includes file path in error message', () => {
    try {
      parseTemplate('/custom/path/template.mdxt', INVALID_FRONTMATTER, false);
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateParseError);
      expect((error as TemplateParseError).filePath).toBe('/custom/path/template.mdxt');
      expect((error as TemplateParseError).message).toContain('/custom/path/template.mdxt');
    }
  });
});

describe('parseTemplateMetadata', () => {
  it('parses metadata without content', () => {
    const metadata = parseTemplateMetadata('/path/to/blog.mdxt', VALID_TEMPLATE, true);

    expect(metadata.id).toBe('blog-post');
    expect(metadata.name).toBe('Blog Post');
    expect(metadata.description).toBe('A standard blog post template');
    expect(metadata.category).toBe('blog');
    expect(metadata.tags).toEqual(['blog', 'article']);
    expect(metadata.author).toBe('mdxpad');
    expect(metadata.isBuiltIn).toBe(true);
    // Metadata should NOT have content, variables, version, dates, or filePath
    expect('content' in metadata).toBe(false);
    expect('variables' in metadata).toBe(false);
    expect('version' in metadata).toBe(false);
    expect('createdAt' in metadata).toBe(false);
    expect('filePath' in metadata).toBe(false);
  });

  it('parses minimal metadata with defaults', () => {
    const metadata = parseTemplateMetadata('/templates/minimal.mdxt', MINIMAL_TEMPLATE, false);

    expect(metadata.id).toBe('minimal');
    expect(metadata.name).toBe('Minimal');
    expect(metadata.category).toBe('notes');
    expect(metadata.tags).toEqual([]);
    expect(metadata.isBuiltIn).toBe(false);
  });

  it('throws TemplateParseError for invalid metadata', () => {
    expect(() => parseTemplateMetadata('/path/to/bad.mdxt', INVALID_FRONTMATTER, false))
      .toThrow(TemplateParseError);
  });
});

describe('TemplateParseError', () => {
  it('has correct error name', () => {
    const error = new TemplateParseError('Test message', '/path/to/file.mdxt');
    expect(error.name).toBe('TemplateParseError');
  });

  it('includes cause when provided', () => {
    const cause = new Error('Original error');
    const error = new TemplateParseError('Test', '/path.mdxt', cause);
    expect(error.cause).toBe(cause);
  });
});
