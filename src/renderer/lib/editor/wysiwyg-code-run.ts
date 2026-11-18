/**
 * Run button for a visual code block marked `run` or `executable`.
 *
 * The source editor already runs those fences. The visual editor keeps the
 * same marker and runs the block in the sandbox.
 */

import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view';

import {
  executeSandboxed,
  type ExecutionResult,
} from '../../features/code-execution/sandbox-runner';

const RUNNABLE = /(?:^|\s)(?:run|executable)(?:\s|$)/i;

export function isRunnableFence(language: string): boolean {
  return RUNNABLE.test(language);
}

function languageName(language: string): string {
  return /^[A-Za-z0-9_+-]+/.exec(language)?.[0] ?? '';
}

function blockText(node: ProseMirrorNode): string {
  const text = node.textContent;
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

function visualEditorClosed(view: EditorView): boolean {
  const editor = view as unknown as { readonly isDestroyed?: boolean };
  return editor.isDestroyed === true;
}

function resultText(result: ExecutionResult): string {
  const lines = [...result.logs];
  if (result.error) {
    lines.push(result.error);
  } else if (result.returnValue) {
    lines.push(result.returnValue);
  }
  return lines.join('\n');
}

/** Editable code block with a Run button when the fence asks for one. */
export class RunnableCodeBlockView implements NodeView {
  readonly dom: HTMLDivElement;
  readonly contentDOM: HTMLElement;
  private readonly button: HTMLButtonElement | null = null;
  private output: HTMLPreElement | null = null;
  private node: ProseMirrorNode;
  private running = false;
  private request = 0;

  constructor(
    node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined
  ) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = 'wysiwyg-code-block';
    this.dom.style.maxWidth = '100%';
    this.dom.style.overflowX = 'auto';
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    const language = languageName(String(node.attrs.language ?? ''));
    if (language.length > 0) {
      code.className = `language-${language}`;
    }
    pre.append(code);
    this.contentDOM = code;
    if (isRunnableFence(String(node.attrs.language ?? ''))) {
      this.button = document.createElement('button');
      this.button.type = 'button';
      this.button.className = 'wysiwyg-run-button';
      this.button.textContent = 'Run';
      this.button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.run();
      });
      this.dom.append(this.button);
    }
    this.dom.append(pre);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type.name !== 'code_block') {
      return false;
    }
    const wasRunnable = isRunnableFence(String(this.node.attrs.language ?? ''));
    const runnable = isRunnableFence(String(node.attrs.language ?? ''));
    if (wasRunnable !== runnable) {
      return false;
    }
    this.node = node;
    return true;
  }

  stopEvent(event: Event): boolean {
    return (
      event.target === this.button ||
      (this.output?.contains(event.target as globalThis.Node) ?? false)
    );
  }

  ignoreMutation(record: ViewMutationRecord): boolean {
    return record.target !== this.contentDOM && !this.contentDOM.contains(record.target);
  }

  private currentNode(): ProseMirrorNode {
    const pos = this.getPos();
    const live = typeof pos === 'number' ? this.view.state.doc.nodeAt(pos) : null;
    return live ?? this.node;
  }

  destroy(): void {
    this.request += 1;
  }

  private async run(): Promise<void> {
    if (!this.button || this.running || visualEditorClosed(this.view)) {
      return;
    }
    const request = ++this.request;
    const code = blockText(this.currentNode());
    this.running = true;
    this.button.textContent = 'Running...';
    this.button.disabled = true;
    const result = await executeSandboxed(code);
    if (request !== this.request || visualEditorClosed(this.view)) {
      return;
    }
    this.running = false;
    this.button.textContent = 'Run';
    this.button.disabled = false;
    if (blockText(this.currentNode()) !== code) {
      return;
    }
    this.show(result);
  }

  private show(result: ExecutionResult): void {
    if (!this.output) {
      this.output = document.createElement('pre');
      this.output.className = 'wysiwyg-code-output';
      this.dom.append(this.output);
    }
    this.output.textContent = resultText(result);
  }
}
