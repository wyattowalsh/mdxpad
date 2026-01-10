/**
 * Integration Tests
 *
 * Tests for full compilation flow, store integration, and iframe communication.
 *
 * @module renderer/__tests__/integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import type {
  RequestId,
  CompileRequest,
  CompileResponse,
  CompileResponseSuccess,
  CompileResponseFailure,
} from '@shared/types/preview-worker';
import { createRequestId } from '@shared/types/preview-worker';
import type { CompileError, CompileSuccess } from '@shared/types/preview';
import {
  isParentToIframeMessage,
  isIframeToParentMessage,
  isRenderCommand,
  isThemeCommand,
  isScrollCommand,
  isReadySignal,
  isSizeSignal,
  isRuntimeErrorSignal,
  type ParentToIframeMessage,
  type IframeToParentMessage,
  type RenderCommand,
  type ThemeCommand,
  type ReadySignal,
  type SizeSignal,
  type RuntimeErrorSignal,
} from '@shared/types/preview-iframe';
import { usePreviewStore } from '../stores/preview-store';
import { compileMdx } from '../lib/mdx/compile';

// Store reference to mock worker instances
let mockWorkerInstance: MockWorker | null = null;
const mockWorkerInstances: MockWorker[] = [];

/** Mock Worker class for testing */
class MockWorker {
  onmessage: ((e: MessageEvent<CompileResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage: Mock;
  terminate: Mock;

  constructor() {
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    mockWorkerInstance = this;
    mockWorkerInstances.push(this);
  }

  simulateSuccess(id: RequestId, code: string, frontmatter: Record<string, unknown> = {}): void {
    const response: CompileResponseSuccess = { id, ok: true, code, frontmatter };
    this.onmessage?.({ data: response } as MessageEvent<CompileResponse>);
  }

  simulateError(id: RequestId, errors: readonly CompileError[]): void {
    const response: CompileResponseFailure = { id, ok: false, errors };
    this.onmessage?.({ data: response } as MessageEvent<CompileResponse>);
  }

  simulateCrash(message: string): void {
    const errorEvent = new ErrorEvent('error', { message });
    this.onerror?.(errorEvent);
  }
}

// Setup mocks before importing compiler
vi.stubGlobal('Worker', MockWorker);

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => {
    const count = (++uuidCounter).toString(16).padStart(12, '0');
    return `550e8400-e29b-41d4-a716-${count}`;
  }),
});

import { createMDXCompiler, type MDXCompiler } from '../lib/mdx/compiler';

describe('Integration - Full Compilation Flow', () => {
  let compiler: MDXCompiler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWorkerInstance = null;
    mockWorkerInstances.length = 0;
    uuidCounter = 0;
    usePreviewStore.getState().reset();
    // Disable heartbeat monitoring to prevent infinite loops with fake timers
    compiler = createMDXCompiler({ disableHeartbeat: true });
  });

  afterEach(() => {
    // Terminate compiler before cleaning up timers
    compiler.terminate();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('compiler to store integration', () => {
    it('should update store on successful compilation', async () => {
      const store = usePreviewStore.getState();

      store.startCompiling();
      expect(usePreviewStore.getState().state.status).toBe('compiling');

      const onSuccess = vi.fn((result: CompileResponseSuccess) => {
        store.setSuccess({
          ok: true,
          code: result.code,
          frontmatter: result.frontmatter,
        });
      });

      const requestId = compiler.compile('# Hello', { onSuccess });
      mockWorkerInstance?.simulateSuccess(requestId, 'compiled-code', { title: 'Hello' });

      await vi.runAllTimersAsync();

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result.code).toBe('compiled-code');
        expect(state.state.result.frontmatter).toEqual({ title: 'Hello' });
      }
    });

    it('should update store on compilation error', async () => {
      const store = usePreviewStore.getState();

      store.startCompiling();

      const onError = vi.fn((errors: readonly CompileError[]) => {
        store.setError(errors);
      });

      const requestId = compiler.compile('# Hello', { onError });
      mockWorkerInstance?.simulateError(requestId, [{ message: 'Syntax error', line: 1 }]);

      await vi.runAllTimersAsync();

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      if (state.state.status === 'error') {
        expect(state.state.errors).toHaveLength(1);
        expect(state.state.errors[0]?.message).toBe('Syntax error');
      }
    });

    it('should preserve last successful render on error', async () => {
      const store = usePreviewStore.getState();

      // First successful compilation
      const successResult: CompileSuccess = {
        ok: true,
        code: 'original-code',
        frontmatter: { title: 'Original' },
      };
      store.setSuccess(successResult);

      // Now trigger error
      store.startCompiling();
      const onError = vi.fn((errors: readonly CompileError[]) => {
        store.setError(errors);
      });

      const requestId = compiler.compile('# Error', { onError });
      mockWorkerInstance?.simulateError(requestId, [{ message: 'Parse error' }]);

      await vi.runAllTimersAsync();

      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      expect(state.lastSuccessfulRender).toEqual(successResult);
    });

    it('should handle rapid compile-cancel-compile cycle', async () => {
      const results: string[] = [];

      const request1 = compiler.compile('# First', {
        onSuccess: () => results.push('first'),
      });

      compiler.cancel(request1);

      const request2 = compiler.compile('# Second', {
        onSuccess: () => results.push('second'),
      });

      // First request cancelled, should not call callback
      mockWorkerInstance?.simulateSuccess(request1, 'first-code');
      // Second request should work
      mockWorkerInstance?.simulateSuccess(request2, 'second-code');

      await vi.runAllTimersAsync();

      expect(results).toEqual(['second']);
    });
  });

  describe('multiple sequential compilations', () => {
    it('should correctly sequence multiple compilations', async () => {
      const results: string[] = [];

      for (let i = 0; i < 5; i++) {
        const requestId = compiler.compile(`# Doc ${i}`, {
          onSuccess: () => results.push(`success-${i}`),
        });
        mockWorkerInstance?.simulateSuccess(requestId, `code-${i}`);
      }

      await vi.runAllTimersAsync();

      expect(results).toEqual(['success-0', 'success-1', 'success-2', 'success-3', 'success-4']);
    });

    it('should handle interleaved success and error responses', async () => {
      const results: Array<{ type: 'success' | 'error'; index: number }> = [];

      for (let i = 0; i < 4; i++) {
        const requestId = compiler.compile(`# Doc ${i}`, {
          onSuccess: () => results.push({ type: 'success', index: i }),
          onError: () => results.push({ type: 'error', index: i }),
        });

        if (i % 2 === 0) {
          mockWorkerInstance?.simulateSuccess(requestId, `code-${i}`);
        } else {
          mockWorkerInstance?.simulateError(requestId, [{ message: `error-${i}` }]);
        }
      }

      await vi.runAllTimersAsync();

      expect(results).toEqual([
        { type: 'success', index: 0 },
        { type: 'error', index: 1 },
        { type: 'success', index: 2 },
        { type: 'error', index: 3 },
      ]);
    });
  });
});

describe('Integration - Iframe Communication', () => {
  describe('message validation flow', () => {
    it('should correctly classify all parent-to-iframe message types', () => {
      const renderCommand: RenderCommand = {
        type: 'render',
        code: 'function Component() {}',
        frontmatter: { title: 'Test' },
      };

      const themeCommand: ThemeCommand = {
        type: 'theme',
        value: 'dark',
      };

      const scrollCommand: ParentToIframeMessage = {
        type: 'scroll',
        ratio: 0.5,
      };

      // All should be valid parent-to-iframe messages
      expect(isParentToIframeMessage(renderCommand)).toBe(true);
      expect(isParentToIframeMessage(themeCommand)).toBe(true);
      expect(isParentToIframeMessage(scrollCommand)).toBe(true);

      // Specific type guards
      expect(isRenderCommand(renderCommand)).toBe(true);
      expect(isThemeCommand(themeCommand)).toBe(true);
      expect(isScrollCommand(scrollCommand)).toBe(true);

      // Cross-checks
      expect(isRenderCommand(themeCommand)).toBe(false);
      expect(isThemeCommand(scrollCommand)).toBe(false);
      expect(isScrollCommand(renderCommand)).toBe(false);
    });

    it('should correctly classify all iframe-to-parent message types', () => {
      const readySignal: ReadySignal = { type: 'ready' };
      const sizeSignal: SizeSignal = { type: 'size', height: 500 };
      const errorSignal: RuntimeErrorSignal = {
        type: 'runtime-error',
        message: 'Component crashed',
        componentStack: 'at Button',
      };

      // All should be valid iframe-to-parent messages
      expect(isIframeToParentMessage(readySignal)).toBe(true);
      expect(isIframeToParentMessage(sizeSignal)).toBe(true);
      expect(isIframeToParentMessage(errorSignal)).toBe(true);

      // Specific type guards
      expect(isReadySignal(readySignal)).toBe(true);
      expect(isSizeSignal(sizeSignal)).toBe(true);
      expect(isRuntimeErrorSignal(errorSignal)).toBe(true);

      // Cross-checks
      expect(isReadySignal(sizeSignal)).toBe(false);
      expect(isSizeSignal(errorSignal)).toBe(false);
      expect(isRuntimeErrorSignal(readySignal)).toBe(false);
    });

    it('should not cross-classify between parent and iframe messages', () => {
      const renderCommand: RenderCommand = {
        type: 'render',
        code: '',
        frontmatter: {},
      };
      const readySignal: ReadySignal = { type: 'ready' };

      expect(isParentToIframeMessage(renderCommand)).toBe(true);
      expect(isIframeToParentMessage(renderCommand)).toBe(false);

      expect(isIframeToParentMessage(readySignal)).toBe(true);
      expect(isParentToIframeMessage(readySignal)).toBe(false);
    });
  });

  describe('message flow simulation', () => {
    it('should simulate complete render cycle', async () => {
      const messageLog: Array<{ direction: string; type: string }> = [];

      // Simulate iframe ready
      const readySignal: ReadySignal = { type: 'ready' };
      if (isIframeToParentMessage(readySignal) && isReadySignal(readySignal)) {
        messageLog.push({ direction: 'iframe->parent', type: 'ready' });
      }

      // Simulate compilation
      const result = await compileMdx('test-id' as RequestId, '# Hello World');

      if (result.ok) {
        // Simulate render command
        const renderCommand: RenderCommand = {
          type: 'render',
          code: result.code,
          frontmatter: result.frontmatter,
        };
        if (isParentToIframeMessage(renderCommand) && isRenderCommand(renderCommand)) {
          messageLog.push({ direction: 'parent->iframe', type: 'render' });
        }

        // Simulate size update from iframe
        const sizeSignal: SizeSignal = { type: 'size', height: 800 };
        if (isIframeToParentMessage(sizeSignal) && isSizeSignal(sizeSignal)) {
          messageLog.push({ direction: 'iframe->parent', type: 'size' });
        }
      }

      expect(messageLog).toEqual([
        { direction: 'iframe->parent', type: 'ready' },
        { direction: 'parent->iframe', type: 'render' },
        { direction: 'iframe->parent', type: 'size' },
      ]);
    });

    it('should simulate error recovery flow', async () => {
      const messageLog: Array<{ direction: string; type: string; error?: string | undefined }> = [];

      // First successful render
      const result1 = await compileMdx('test-1' as RequestId, '# Valid');
      if (result1.ok) {
        const renderCommand: RenderCommand = {
          type: 'render',
          code: result1.code,
          frontmatter: result1.frontmatter,
        };
        messageLog.push({ direction: 'parent->iframe', type: 'render' });
      }

      // Error during next compilation
      const result2 = await compileMdx('test-2' as RequestId, '<div>Unclosed');
      if (!result2.ok) {
        messageLog.push({
          direction: 'compilation',
          type: 'error',
          error: result2.errors[0]?.message,
        });
        // In real app, we'd show error overlay but keep previous render
      }

      // Runtime error from iframe
      const runtimeError: RuntimeErrorSignal = {
        type: 'runtime-error',
        message: 'TypeError: Cannot read properties of undefined',
      };
      if (isRuntimeErrorSignal(runtimeError)) {
        messageLog.push({
          direction: 'iframe->parent',
          type: 'runtime-error',
          error: runtimeError.message,
        });
      }

      expect(messageLog.length).toBeGreaterThanOrEqual(2);
      expect(messageLog[0]).toEqual({ direction: 'parent->iframe', type: 'render' });
    });

    it('should simulate theme synchronization', () => {
      const themeChanges: Array<'light' | 'dark'> = [];

      // Initial theme
      const lightTheme: ThemeCommand = { type: 'theme', value: 'light' };
      if (isThemeCommand(lightTheme)) {
        themeChanges.push(lightTheme.value);
      }

      // User toggles to dark
      const darkTheme: ThemeCommand = { type: 'theme', value: 'dark' };
      if (isThemeCommand(darkTheme)) {
        themeChanges.push(darkTheme.value);
      }

      // User toggles back to light
      if (isThemeCommand(lightTheme)) {
        themeChanges.push(lightTheme.value);
      }

      expect(themeChanges).toEqual(['light', 'dark', 'light']);
    });

    it('should simulate scroll synchronization with store', () => {
      const store = usePreviewStore.getState();
      const scrollPositions: number[] = [];

      // Simulate scroll events
      const scrollRatios = [0, 0.25, 0.5, 0.75, 1];
      for (const ratio of scrollRatios) {
        store.setScrollRatio(ratio);
        scrollPositions.push(usePreviewStore.getState().scrollRatio);
      }

      expect(scrollPositions).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });
  });
});

describe('Integration - Request ID Correlation', () => {
  describe('end-to-end request tracking', () => {
    it('should maintain request ID through full cycle', async () => {
      const customId = createRequestId();

      // Use direct compilation (not worker-based) for predictable testing
      const result = await compileMdx(customId, '# Test Document');

      expect(result.id).toBe(customId);
      expect(result.ok).toBe(true);
    });

    it('should generate unique IDs for each request', () => {
      const ids = new Set<RequestId>();

      for (let i = 0; i < 100; i++) {
        ids.add(createRequestId());
      }

      expect(ids.size).toBe(100);
    });

    it('should format IDs as valid UUID v4', () => {
      const uuidv4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (let i = 0; i < 10; i++) {
        const id = createRequestId();
        expect(id).toMatch(uuidv4Pattern);
      }
    });
  });
});

describe('Integration - Store Selectors', () => {
  beforeEach(() => {
    usePreviewStore.getState().reset();
  });

  describe('selector consistency', () => {
    it('should return consistent values across all status selectors', () => {
      const store = usePreviewStore.getState();

      // Idle state
      expect(store.state.status).toBe('idle');

      // Compiling state
      store.startCompiling();
      let state = usePreviewStore.getState();
      expect(state.state.status).toBe('compiling');

      // Success state
      store.setSuccess({ ok: true, code: 'code', frontmatter: {} });
      state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result.code).toBe('code');
      }

      // Error state
      store.setError([{ message: 'error' }]);
      state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      if (state.state.status === 'error') {
        expect(state.state.errors[0]?.message).toBe('error');
      }
    });

    it('should correctly derive renderable content', () => {
      const store = usePreviewStore.getState();
      const successResult: CompileSuccess = { ok: true, code: 'original', frontmatter: {} };

      // Initially null
      let state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toBeNull();

      // After success
      store.setSuccess(successResult);
      state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toEqual(successResult);

      // After error (should preserve)
      store.setError([{ message: 'error' }]);
      state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toEqual(successResult);

      // After compiling (should preserve)
      store.startCompiling();
      state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toEqual(successResult);

      // After reset
      store.reset();
      state = usePreviewStore.getState();
      expect(state.lastSuccessfulRender).toBeNull();
    });
  });
});
