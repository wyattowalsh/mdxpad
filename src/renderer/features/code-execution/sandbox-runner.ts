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
const MESSAGE_TYPE = 'mdxpad-sandbox-result';

// =============================================================================
// Sandbox HTML Template
// =============================================================================

/**
 * Build the srcdoc HTML for the sandboxed iframe.
 *
 * The iframe intercepts console.log calls and posts the result
 * back to the parent via postMessage.
 */
function buildSandboxHtml(code: string): string {
  // Escape script-breaking sequences in user code
  const escaped = code.replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  var logs = [];
  var origLog = console.log;
  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    var line = args.map(function(a) {
      if (typeof a === 'object') {
        try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
      }
      return String(a);
    }).join(' ');
    logs.push(line);
    origLog.apply(console, arguments);
  };
  console.warn = console.log;
  console.info = console.log;

  try {
    var __result = (function() {
      ${escaped}
    })();
    var returnValue = __result !== undefined ? String(__result) : null;
    parent.postMessage({
      type: '${MESSAGE_TYPE}',
      success: true,
      logs: logs,
      returnValue: returnValue,
      error: null
    }, '*');
  } catch(e) {
    parent.postMessage({
      type: '${MESSAGE_TYPE}',
      success: false,
      logs: logs,
      returnValue: null,
      error: e instanceof Error ? e.message : String(e)
    }, '*');
  }
})();
</script>
</body>
</html>`;
}

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.data?.type !== MESSAGE_TYPE) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      const durationMs = performance.now() - startTime;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const success = Boolean(event.data.success);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const logs: string[] = Array.isArray(event.data.logs)
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (event.data.logs as string[])
        : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const returnValue = event.data.returnValue != null ? String(event.data.returnValue) : null;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const error = event.data.error != null ? String(event.data.error) : null;

      cleanup();
      resolve({ success, logs, returnValue, error, durationMs });
    };

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
    iframe.srcdoc = buildSandboxHtml(code);
  });
}
