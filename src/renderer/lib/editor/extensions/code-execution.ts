/**
 * Code Execution Extension for CodeMirror
 *
 * Detects code fences with a `run` or `executable` flag and adds
 * a "Run" button widget. Executes code in a sandboxed iframe and
 * displays output below the fence as a CM decoration widget.
 *
 * @module renderer/lib/editor/extensions/code-execution
 */

import { type Extension, StateField, StateEffect, type Range, RangeSet } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';

import {
  executeSandboxed,
  type ExecutionResult,
} from '../../../features/code-execution/sandbox-runner';

// =============================================================================
// Types
// =============================================================================

interface CodeFenceInfo {
  /** Start position of the opening fence line */
  readonly fenceStart: number;
  /** End position of the closing fence line */
  readonly fenceEnd: number;
  /** The code content between the fences */
  readonly code: string;
  /** Language identifier */
  readonly language: string;
}

interface ExecutionState {
  readonly isRunning: boolean;
  readonly result: ExecutionResult | null;
}

// =============================================================================
// Constants
// =============================================================================

const RUNNABLE_FENCE_REGEX = /^(`{3,})([\w]*)\s+(run|executable)\s*$/;
const CLOSING_FENCE_REGEX = /^`{3,}\s*$/;

// =============================================================================
// State Effects & Fields
// =============================================================================

const setExecutionResult = StateEffect.define<{
  fenceStart: number;
  state: ExecutionState;
}>();

const executionResultsField = StateField.define<Map<number, ExecutionState>>({
  create() {
    return new Map();
  },
  update(value, tr) {
    let updated = value;
    for (const effect of tr.effects) {
      if (effect.is(setExecutionResult)) {
        updated = new Map(updated);
        updated.set(effect.value.fenceStart, effect.value.state);
      }
    }
    return updated;
  },
});

// =============================================================================
// Fence Detection
// =============================================================================

/**
 * Find all runnable code fences in the document.
 */
function findRunnableFences(doc: { toString(): string }): CodeFenceInfo[] {
  const text = doc.toString();
  const lines = text.split('\n');
  const fences: CodeFenceInfo[] = [];

  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const match = RUNNABLE_FENCE_REGEX.exec(line);

    if (match) {
      const fenceStart = pos;
      const lang = match[2] ?? '';
      const codeLines: string[] = [];
      let fenceEnd = pos + line.length;

      // Find closing fence
      let j = i + 1;
      let innerPos = fenceEnd + 1; // +1 for the newline
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine === undefined) break;
        if (CLOSING_FENCE_REGEX.test(nextLine)) {
          fenceEnd = innerPos + nextLine.length;
          break;
        }
        codeLines.push(nextLine);
        innerPos += nextLine.length + 1;
        j++;
      }

      fences.push({
        fenceStart,
        fenceEnd,
        code: codeLines.join('\n'),
        language: lang,
      });

      // Skip to after the closing fence
      i = j;
      pos = fenceEnd + 1;
      continue;
    }

    pos += line.length + 1;
  }

  return fences;
}

// =============================================================================
// Widgets
// =============================================================================

/**
 * "Run" button widget placed at the start of a runnable code fence.
 */
class RunButtonWidget extends WidgetType {
  constructor(
    private readonly fenceStart: number,
    private readonly isRunning: boolean
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement('button');
    button.className = 'cm-run-button';
    button.textContent = this.isRunning ? 'Running...' : 'Run';
    button.disabled = this.isRunning;
    button.style.cssText =
      'display:inline-block;padding:1px 8px;margin-left:8px;' +
      'font-size:11px;border-radius:3px;cursor:pointer;' +
      'background:#2563eb;color:white;border:none;vertical-align:middle;';

    if (this.isRunning) {
      button.style.opacity = '0.6';
      button.style.cursor = 'wait';
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void runCodeFence(view, this.fenceStart);
    });

    return button;
  }

  override eq(other: RunButtonWidget): boolean {
    return this.fenceStart === other.fenceStart && this.isRunning === other.isRunning;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Output widget placed after a runnable code fence.
 */
class OutputWidget extends WidgetType {
  constructor(private readonly result: ExecutionResult) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-code-output';
    container.style.cssText =
      'border-left:2px solid;padding:4px 8px;margin:2px 0;' +
      'font-family:monospace;font-size:12px;white-space:pre-wrap;';

    if (this.result.success) {
      container.style.borderColor = '#22c55e';
      container.style.background = 'rgba(34,197,94,0.05)';
    } else {
      container.style.borderColor = '#ef4444';
      container.style.background = 'rgba(239,68,68,0.05)';
    }

    const header = document.createElement('div');
    header.style.cssText = 'font-size:10px;color:#888;margin-bottom:2px;';
    header.textContent = `${this.result.success ? 'Output' : 'Error'} (${this.result.durationMs.toFixed(0)}ms)`;
    container.appendChild(header);

    if (this.result.logs.length > 0) {
      for (const line of this.result.logs) {
        const div = document.createElement('div');
        div.textContent = line;
        div.style.color = '#d4d4d8';
        container.appendChild(div);
      }
    }

    if (this.result.returnValue !== null) {
      const retDiv = document.createElement('div');
      retDiv.textContent = `=> ${this.result.returnValue}`;
      retDiv.style.color = '#34d399';
      container.appendChild(retDiv);
    }

    if (this.result.error) {
      const errDiv = document.createElement('div');
      errDiv.textContent = this.result.error;
      errDiv.style.color = '#f87171';
      container.appendChild(errDiv);
    }

    return container;
  }

  override eq(other: OutputWidget): boolean {
    return (
      this.result.success === other.result.success &&
      this.result.error === other.result.error &&
      this.result.returnValue === other.result.returnValue &&
      this.result.logs.length === other.result.logs.length
    );
  }
}

// =============================================================================
// Code Execution Handler
// =============================================================================

/**
 * Execute the code in a runnable fence and dispatch the result.
 */
function sourceEditorClosed(view: EditorView): boolean {
  const editor = view as unknown as { readonly destroyed?: boolean };
  return editor.destroyed === true;
}

async function runCodeFence(view: EditorView, fenceStart: number): Promise<void> {
  if (sourceEditorClosed(view)) {
    return;
  }
  const fences = findRunnableFences(view.state.doc);
  const fence = fences.find((item) => item.fenceStart === fenceStart);
  if (!fence) {
    return;
  }

  view.dispatch({
    effects: setExecutionResult.of({
      fenceStart,
      state: { isRunning: true, result: null },
    }),
  });

  const result = await executeSandboxed(fence.code);
  if (sourceEditorClosed(view)) {
    return;
  }
  const sameFence = findRunnableFences(view.state.doc).some(
    (item) => item.fenceStart === fenceStart && item.code === fence.code
  );
  if (!sameFence) {
    return;
  }

  view.dispatch({
    effects: setExecutionResult.of({
      fenceStart,
      state: { isRunning: false, result },
    }),
  });
}

// =============================================================================
// Decoration Builder
// =============================================================================

function buildDecorations(
  view: EditorView,
  executionResults: Map<number, ExecutionState>
): DecorationSet {
  const fences = findRunnableFences(view.state.doc);
  const decorations: Range<Decoration>[] = [];

  for (const fence of fences) {
    const execState = executionResults.get(fence.fenceStart);
    const isRunning = execState?.isRunning ?? false;

    // Add run button at the end of the opening fence line
    const openingLine = view.state.doc.lineAt(fence.fenceStart);
    decorations.push(
      Decoration.widget({
        widget: new RunButtonWidget(fence.fenceStart, isRunning),
        side: 1,
      }).range(openingLine.to)
    );

    // Add output widget after closing fence if we have a result
    if (execState?.result) {
      decorations.push(
        Decoration.widget({
          widget: new OutputWidget(execState.result),
          block: true,
          side: 1,
        }).range(fence.fenceEnd)
      );
    }
  }

  // Sort by position for RangeSet
  decorations.sort((a, b) => a.from - b.from);

  return RangeSet.of(decorations);
}

// =============================================================================
// Extension
// =============================================================================

/**
 * Code execution extension for CodeMirror.
 *
 * Detects code fences with `run` or `executable` flag and provides:
 * - "Run" button widget on runnable code fences
 * - Sandboxed JavaScript execution via iframe
 * - Output display below code fences
 *
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { codeExecutionExtension } from './code-execution';
 *
 * const view = new EditorView({
 *   extensions: [codeExecutionExtension()],
 * });
 * ```
 */
export function codeExecutionExtension(): Extension {
  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        const results = view.state.field(executionResultsField);
        this.decorations = buildDecorations(view, results);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.state.field(executionResultsField) !==
            update.startState.field(executionResultsField)
        ) {
          const results = update.state.field(executionResultsField);
          this.decorations = buildDecorations(update.view, results);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return [executionResultsField, decorationPlugin];
}

// Export for testing
export { findRunnableFences, RUNNABLE_FENCE_REGEX, CLOSING_FENCE_REGEX };
export type { CodeFenceInfo };
