import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  it('extracts code content from nested <code> children', () => {
    const { container } = render(
      <CodeBlock>
        <code className="language-ts">const answer: number = 42;</code>
      </CodeBlock>
    );

    const codeEl = container.querySelector('code');
    expect(codeEl?.textContent).toBe('const answer: number = 42;');
    expect(codeEl?.className).toContain('language-ts');
  });

  it('renders mermaid fences as mermaid blocks', () => {
    const { container } = render(
      <CodeBlock className="language-mermaid">{'graph TD\n  A-->B'}</CodeBlock>
    );

    const mermaidBlock = container.querySelector('pre.mermaid');
    expect(mermaidBlock).not.toBeNull();
    expect(mermaidBlock?.textContent).toContain('A-->B');
  });
});
