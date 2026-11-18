import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeSandboxed } from '../../features/code-execution/sandbox-runner';
import { mdxSchema } from './prosemirror-mdx-schema';
import { documentFromMarkdown } from './wysiwyg-document';
import { RunnableCodeBlockView, isRunnableFence } from './wysiwyg-code-run';

vi.mock('../../features/code-execution/sandbox-runner', () => ({
  executeSandboxed: vi.fn(),
}));

function open(source: string): EditorView {
  const doc = documentFromMarkdown(source);
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new EditorView(host, {
    state: EditorState.create({ doc, schema: mdxSchema }),
    nodeViews: {
      code_block(node, view, getPos) {
        return new RunnableCodeBlockView(node, view, getPos);
      },
    },
  });
}

describe('visual runnable code', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    vi.mocked(executeSandboxed).mockReset();
    for (const view of views.splice(0)) {
      view.dom.parentElement?.remove();
      view.destroy();
    }
  });

  it('recognizes a run marker and leaves a plain fence alone', () => {
    expect(isRunnableFence('js run')).toBe(true);
    expect(isRunnableFence('executable')).toBe(true);
    expect(isRunnableFence('js')).toBe(false);
  });

  it('runs a marked block and shows the sandbox output', async () => {
    vi.mocked(executeSandboxed).mockResolvedValue({
      success: true,
      logs: ['1'],
      returnValue: null,
      error: null,
      durationMs: 1,
    });
    const view = open('```js run\nconsole.log(1)\n```\n');
    views.push(view);
    const button = view.dom.querySelector('button');
    expect(button?.textContent).toBe('Run');
    button?.click();
    expect(executeSandboxed).toHaveBeenCalledWith('console.log(1)');
    await vi.waitFor(() => {
      expect(view.dom.querySelector('.wysiwyg-code-output')?.textContent).toBe('1');
    });
  });

  it('does not add a Run button to an ordinary code block', () => {
    const view = open('```\nhello\n```\n');
    views.push(view);
    expect(view.dom.querySelector('button')).toBeNull();
    expect(view.dom.querySelector('.wysiwyg-code-block')?.getAttribute('style')).toContain(
      'max-width: 100%'
    );
    expect(view.dom.textContent).toContain('hello');
  });
});
