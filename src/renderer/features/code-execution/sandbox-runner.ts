/**
 * Sandboxed Code Execution Runner
 *
 * Executes JavaScript code in a sandboxed iframe for safe
 * in-editor code execution. Captures console output and return values.
 *
 * @module renderer/features/code-execution/sandbox-runner
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a sandboxed code execution.
 */
export interface ExecutionResult {
  /** Whether the execution succeeded */
  readonly success: boolean;
  /** Captured console.log output lines */
  readonly logs: readonly string[];
  /** Return value (last expression), serialized as string */
  readonly returnValue: string | null;
  /** Error message if execution failed */
  readonly error: string | null;
  /** Execution duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Options for sandbox execution.
 */
export interface SandboxOptions {
  /** Maximum execution time in milliseconds. Defaults to 5000. */
  readonly timeoutMs?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 5000;
const MESSAGE_READY = 'mdxpad-sandbox-ready';
const MESSAGE_RUN = 'mdxpad-sandbox-run';
const MESSAGE_RESULT = 'mdxpad-sandbox-result';

function sandboxDocumentUrl(): string {
  return new URL('code-sandbox.html', window.location.href).href;
}

interface SandboxMessage {
  readonly type: string;
  readonly success: boolean;
  readonly logs: string[];
  readonly returnValue: string | null;
  readonly error: string | null;
}

function messageText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function readSandboxMessage(value: unknown): SandboxMessage | null {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== 'string') {
    return null;
  }
  const logs = Array.isArray(record.logs)
    ? record.logs.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    type,
    success: record.success === true,
    logs,
    returnValue: messageText(record.returnValue),
    error: messageText(record.error),
  };
}

// =============================================================================
// Sandbox HTML Template
// =============================================================================

// =============================================================================
// Public API
// =============================================================================

/**
 * Execute JavaScript code in a sandboxed iframe.
 *
 * Creates a temporary iframe with `sandbox` attribute that restricts
 * access to the parent window and DOM. Captures console output and
 * the return value of the executed code.
 *
 * @param code - JavaScript code to execute
 * @param options - Execution options
 * @returns Promise resolving to the execution result
 *
 * @example
 * ```typescript
 * const result = await executeSandboxed('console.log("hello"); 2 + 2');
 * // result.logs === ['hello']
 * // result.returnValue === '4'
 * ```
 */
export function executeSandboxed(
  code: string,
  options: SandboxOptions = {}
): Promise<ExecutionResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const startTime = performance.now();

  return new Promise<ExecutionResult>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts');

    let settled = false;
    let started = false;

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      window.removeEventListener('message', onMessage);
    };

    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({
          success: false,
          logs: [],
          returnValue: null,
          error: `Execution timed out after ${timeoutMs}ms`,
          durationMs: performance.now() - startTime,
        });
      }
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
      if (
        event.origin !== 'null' &&
        event.origin !== window.location.origin &&
        event.origin !== 'file://'
      ) {
        return;
      }
      const data = readSandboxMessage(event.data);
      if (!data) return;
      if (data.type === MESSAGE_READY) {
        if (started) return;
        started = true;
        iframe.contentWindow.postMessage({ type: MESSAGE_RUN, code }, '*');
        return;
      }
      if (data.type !== MESSAGE_RESULT) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      const durationMs = performance.now() - startTime;
      const success = data.success;
      const logs = data.logs;
      const returnValue = data.returnValue;
      const error = data.error;

      cleanup();
      resolve({ success, logs, returnValue, error, durationMs });
    };

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
    iframe.src = sandboxDocumentUrl();
  });
}
