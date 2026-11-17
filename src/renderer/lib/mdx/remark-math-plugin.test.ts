import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RequestId } from '@shared/types/preview-worker';
import { createModuleFromCode } from '@renderer/preview-frame/mdx-module-runtime';

import { compileMdx } from './compile';

const testId = (id: string): RequestId => id as RequestId;

describe('remark math prices', () => {
  it('leaves a price out of KaTeX', async () => {
    const result = await compileMdx(testId('price'), 'It costs $5 and $10 today.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).not.toContain('katex');
    }
  });

  it('keeps a live expression that contains a colon', async () => {
    const result = await compileMdx(testId('mdx-live'), '{css({ color: "red" })}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('color');
    }
  });

  it('compiles a heart, a nested type, and a fragment in prose', async () => {
    const result = await compileMdx(
      testId('mdx-angles'),
      'I <3 this, Array<Array<T>>, and <> here, plus {#anchor}'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('I <3 this');
      expect(result.code).toContain('Array');
    }
  });

  it('shows a template placeholder and keeps a style object', async () => {
    const placeholder = await compileMdx(testId('mdx-template'), 'Hello {{name}}!');
    expect(placeholder.ok).toBe(true);
    if (placeholder.ok) {
      expect(placeholder.code).toContain('{{name}}');
      const module = await createModuleFromCode(placeholder.code);
      expect(render(createElement(module.default)).container.textContent).toContain('{{name}}');
    }

    const styled = await compileMdx(
      testId('mdx-style'),
      '<div style={{ color: "red" }}>ok</div>'
    );
    expect(styled.ok).toBe(true);
    if (styled.ok) {
      expect(styled.code).toContain('color');
      expect(styled.code).toContain('red');
    }
  });

  it('strikes a double tilde and leaves a single tilde as text', async () => {
    const result = await compileMdx(testId('mdx-tilde'), 'H~2~O and ~~gone~~');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('H~2~O');
      expect(result.code).toContain('"gone"');
      expect(result.code).not.toContain('"2"');
    }
  });

  it('compiles a comparison and a JSON sample', async () => {
    const result = await compileMdx(testId('mdx-json'), 'Compare a <= b and JSON {"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('Compare');
      expect(result.code).toContain('JSON');
    }
  });

  it('compiles an autolink and a generic type', async () => {
    const result = await compileMdx(
      testId('mdx-autolink'),
      'See <https://example.com> and List<T> and <Card>Hi</Card>'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('https://example.com');
      expect(result.code).toContain('List');
      expect(result.code).toContain('Card');
    }
  });

  it('compiles a markdown comment and a line break', async () => {
    const result = await compileMdx(testId('mdx-html'), 'See <!-- secret --> this.<br>Next');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('this.');
      expect(result.code).toContain('Next');
      expect(result.code).not.toContain('secret');
    }
  });

  it('renders a TeX inline formula', async () => {
    const result = await compileMdx(testId('tex-inline'), 'The area is \\(x^2\\).');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
      expect(result.code).not.toContain('\\(x^2\\)');
    }
  });

  it('keeps a real formula', async () => {
    const result = await compileMdx(testId('formula'), 'The area is $x^2$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });

  it('keeps a formula that contains spaces', async () => {
    const result = await compileMdx(testId('spaced'), 'The sum is $a + b$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });
});
