/**
 * Tests for Template Variable Utilities
 *
 * Feature: 016-template-library
 * Task: T032 (Template Variables Unit Tests)
 *
 * @module tests/unit/template-variables.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractVariables,
  substituteVariables,
  validateVariables,
  buildVariableValues,
  getAutoValue,
  isAutoVariable,
} from './template-variables';
import type { TemplateVariable } from '@shared/contracts/template-schemas';

// =============================================================================
// getAutoValue Tests
// =============================================================================

describe('getAutoValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns ISO date for "date" variable', () => {
    expect(getAutoValue('date')).toBe('2026-01-17');
  });

  it('returns ISO datetime for "datetime" variable', () => {
    expect(getAutoValue('datetime')).toBe('2026-01-17T14:30:00.000Z');
  });

  it('returns null for "author" variable (not yet implemented)', () => {
    expect(getAutoValue('author')).toBeNull();
  });

  it('returns null for non-special variables', () => {
    expect(getAutoValue('title')).toBeNull();
    expect(getAutoValue('name')).toBeNull();
    expect(getAutoValue('custom')).toBeNull();
  });
});

describe('isAutoVariable', () => {
  it('returns true for auto-variables', () => {
    expect(isAutoVariable('date')).toBe(true);
    expect(isAutoVariable('datetime')).toBe(true);
    expect(isAutoVariable('author')).toBe(true);
  });

  it('returns false for non-auto variables', () => {
    expect(isAutoVariable('title')).toBe(false);
    expect(isAutoVariable('name')).toBe(false);
  });
});

// =============================================================================
// extractVariables Tests
// =============================================================================

describe('extractVariables', () => {
  it('extracts single variable', () => {
    expect(extractVariables('Hello {{name}}')).toEqual(['name']);
  });

  it('extracts multiple variables', () => {
    expect(extractVariables('{{greeting}} {{name}}!')).toEqual(['greeting', 'name']);
  });

  it('returns unique variables', () => {
    expect(extractVariables('{{name}} and {{name}} again')).toEqual(['name']);
  });

  it('handles variables with underscores', () => {
    expect(extractVariables('{{first_name}} {{last_name}}')).toEqual(['first_name', 'last_name']);
  });

  it('returns empty array for no variables', () => {
    expect(extractVariables('No variables here')).toEqual([]);
  });

  it('ignores malformed patterns', () => {
    expect(extractVariables('{{}} {{ }} {name} {{name')).toEqual([]);
  });
});

// =============================================================================
// substituteVariables Tests
// =============================================================================

describe('substituteVariables', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('substitutes provided values', () => {
    const result = substituteVariables('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('substitutes multiple variables', () => {
    const result = substituteVariables('{{greeting}} {{name}}!', {
      greeting: 'Hello',
      name: 'World',
    });
    expect(result).toBe('Hello World!');
  });

  it('auto-substitutes date variable', () => {
    const result = substituteVariables('Date: {{date}}', {});
    expect(result).toBe('Date: 2026-01-17');
  });

  it('auto-substitutes datetime variable', () => {
    const result = substituteVariables('Time: {{datetime}}', {});
    expect(result).toBe('Time: 2026-01-17T14:30:00.000Z');
  });

  it('preserves unmatched variables', () => {
    const result = substituteVariables('Hello {{name}}!', {});
    expect(result).toBe('Hello {{name}}!');
  });

  // ==========================================================================
  // T036 - Placeholder Preservation Tests
  // ==========================================================================

  describe('static placeholder preservation (T036)', () => {
    it('preserves [TODO: ...] bracket syntax', () => {
      const content = '# {{title}}\n\n[TODO: Add your content here]';
      const result = substituteVariables(content, { title: 'My Post' });
      expect(result).toBe('# My Post\n\n[TODO: Add your content here]');
    });

    it('preserves [PLACEHOLDER: ...] bracket syntax', () => {
      const content = '{{date}} - [PLACEHOLDER: Insert summary]';
      const result = substituteVariables(content, {});
      expect(result).toBe('2026-01-17 - [PLACEHOLDER: Insert summary]');
    });

    it('preserves <!-- TODO: ... --> HTML comment syntax', () => {
      const content = '# {{title}}\n\n<!-- TODO: Add description -->';
      const result = substituteVariables(content, { title: 'Article' });
      expect(result).toBe('# Article\n\n<!-- TODO: Add description -->');
    });

    it('preserves <!-- PLACEHOLDER --> HTML comment syntax', () => {
      const content = '{{greeting}} <!-- PLACEHOLDER -->';
      const result = substituteVariables(content, { greeting: 'Hello' });
      expect(result).toBe('Hello <!-- PLACEHOLDER -->');
    });

    it('handles mixed placeholders and variables', () => {
      const content = `# {{title}}

*Published on {{date}}*

[TODO: Write introduction paragraph]

## Section 1

<!-- PLACEHOLDER: Add main content -->

## Conclusion

[PLACEHOLDER: Add concluding remarks]`;

      const result = substituteVariables(content, { title: 'My Article' });

      expect(result).toContain('# My Article');
      expect(result).toContain('2026-01-17'); // Auto-computed date
      expect(result).toContain('[TODO: Write introduction paragraph]');
      expect(result).toContain('<!-- PLACEHOLDER: Add main content -->');
      expect(result).toContain('[PLACEHOLDER: Add concluding remarks]');
    });

    it('preserves all placeholder formats in complex template', () => {
      const template = `---
title: "{{title}}"
date: {{date}}
---

# {{title}}

[TODO: Add featured image]

## Introduction

<!-- TODO: Hook the reader with a compelling opening -->

{{intro}}

## Main Content

[PLACEHOLDER: Expand on your key points here]

<!-- PLACEHOLDER: Include supporting evidence -->

## Conclusion

[TODO: Summarize key takeaways]`;

      const result = substituteVariables(template, {
        title: 'Test Post',
        intro: 'This is the intro.',
      });

      // Variables substituted
      expect(result).toContain('title: "Test Post"');
      expect(result).toContain('date: 2026-01-17');
      expect(result).toContain('# Test Post');
      expect(result).toContain('This is the intro.');

      // Static placeholders preserved
      expect(result).toContain('[TODO: Add featured image]');
      expect(result).toContain('<!-- TODO: Hook the reader with a compelling opening -->');
      expect(result).toContain('[PLACEHOLDER: Expand on your key points here]');
      expect(result).toContain('<!-- PLACEHOLDER: Include supporting evidence -->');
      expect(result).toContain('[TODO: Summarize key takeaways]');
    });
  });
});

// =============================================================================
// validateVariables Tests
// =============================================================================

describe('validateVariables', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes when all required variables have values', () => {
    const vars: TemplateVariable[] = [{ name: 'title', required: true }];
    const result = validateVariables(vars, { title: 'Hello' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when required variable is missing', () => {
    const vars: TemplateVariable[] = [{ name: 'title', required: true }];
    const result = validateVariables(vars, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Required variable "title" is missing');
  });

  it('passes when required variable has default', () => {
    const vars: TemplateVariable[] = [{ name: 'title', required: true, default: 'Untitled' }];
    const result = validateVariables(vars, {});
    expect(result.valid).toBe(true);
  });

  it('passes for auto-variables without explicit value', () => {
    const vars: TemplateVariable[] = [{ name: 'date', required: true }];
    const result = validateVariables(vars, {});
    expect(result.valid).toBe(true);
  });

  it('ignores non-required variables', () => {
    const vars: TemplateVariable[] = [{ name: 'optional', required: false }];
    const result = validateVariables(vars, {});
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// buildVariableValues Tests
// =============================================================================

describe('buildVariableValues', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses provided values', () => {
    const vars: TemplateVariable[] = [{ name: 'title', required: true }];
    const result = buildVariableValues(vars, { title: 'Hello' });
    expect(result.title).toBe('Hello');
  });

  it('applies defaults for missing values', () => {
    const vars: TemplateVariable[] = [{ name: 'title', required: false, default: 'Default Title' }];
    const result = buildVariableValues(vars, {});
    expect(result.title).toBe('Default Title');
  });

  it('auto-computes date variable', () => {
    const vars: TemplateVariable[] = [{ name: 'date', required: false }];
    const result = buildVariableValues(vars, {});
    expect(result.date).toBe('2026-01-17');
  });

  it('auto-computes datetime variable', () => {
    const vars: TemplateVariable[] = [{ name: 'datetime', required: false }];
    const result = buildVariableValues(vars, {});
    expect(result.datetime).toBe('2026-01-17T14:30:00.000Z');
  });

  it('prefers user value over auto-computed', () => {
    const vars: TemplateVariable[] = [{ name: 'date', required: false }];
    const result = buildVariableValues(vars, { date: '2025-12-25' });
    expect(result.date).toBe('2025-12-25');
  });
});
