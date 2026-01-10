/**
 * Tests for usePreview hook.
 *
 * Tests debounced MDX compilation with Web Worker, stale response handling,
 * state transitions, and cleanup behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreview, usePreviewStatus, type UsePreviewOptions } from '../hooks/usePreview';
import { usePreviewStore } from '../stores/preview-store';
import type { CompileSuccess, CompileError } from '@shared/types/preview';
import type { CompileResponseSuccess } from '@shared/types/preview-worker';

// Mock types for compiler
interface MockCompiler {
  compile: Mock;
  cancel: Mock;
  terminate: Mock;
}

// Store the mock compiler instance for test access
let mockCompiler: MockCompiler;

// Mock the compiler module
vi.mock('@renderer/lib/mdx/compiler', () => ({
  createMDXCompiler: vi.fn(() => {
    mockCompiler = {
      compile: vi.fn(),
      cancel: vi.fn(),
      terminate: vi.fn(),
    };
    return mockCompiler;
  }),
}));

// Import after mock to get the mocked version
import { createMDXCompiler } from '@renderer/lib/mdx/compiler';

describe('usePreview', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePreviewStore.getState().reset();

    // Clear all mocks
    vi.clearAllMocks();

    // Use fake timers for debounce testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('returns initial state (idle, null lastSuccessfulRender, scrollRatio 0)', () => {
      const { result } = renderHook(() => usePreview(''));

      expect(result.current.state.status).toBe('idle');
      expect(result.current.lastSuccessfulRender).toBeNull();
      expect(result.current.scrollRatio).toBe(0);
    });
  });

  describe('debouncing', () => {
    it('debounces compilation with default 300ms', () => {
      const { result } = renderHook(() => usePreview('# Hello'));

      // Immediately after render, compiler should not be called yet
      expect(createMDXCompiler).not.toHaveBeenCalled();

      // Advance time by 299ms - still should not compile
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(mockCompiler?.compile).toBeUndefined();

      // Advance past 300ms threshold
      act(() => {
        vi.advanceTimersByTime(2);
      });

      // Now compiler should have been created and compile called
      expect(createMDXCompiler).toHaveBeenCalled();
      expect(mockCompiler.compile).toHaveBeenCalledWith(
        '# Hello',
        expect.objectContaining({
          requestId: expect.any(String),
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    it('custom debounceMs option works', () => {
      const options: UsePreviewOptions = { debounceMs: 500 };
      renderHook(() => usePreview('# Test', options));

      // Advance by 400ms - should not compile yet
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(createMDXCompiler).not.toHaveBeenCalled();

      // Advance past 500ms
      act(() => {
        vi.advanceTimersByTime(101);
      });
      expect(createMDXCompiler).toHaveBeenCalled();
      expect(mockCompiler.compile).toHaveBeenCalled();
    });
  });

  describe('empty source handling', () => {
    it('empty source returns success with empty code (no worker call)', () => {
      renderHook(() => usePreview(''));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Compiler should NOT be created for empty source
      expect(createMDXCompiler).not.toHaveBeenCalled();

      // Store should transition to success with empty result
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result.code).toBe('');
        expect(state.state.result.frontmatter).toEqual({});
      }
    });
  });

  describe('source change cancellation', () => {
    it('source changes cancel previous pending requests', () => {
      const { rerender } = renderHook(
        ({ source }) => usePreview(source),
        { initialProps: { source: '# First' } }
      );

      // Advance to trigger first compilation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the first request ID from the compile call
      const firstCallArgs = mockCompiler.compile.mock.calls[0];
      expect(firstCallArgs).toBeDefined();
      const firstRequestId = firstCallArgs![1].requestId;

      // Change source before first compilation completes
      rerender({ source: '# Second' });

      // The previous request should be cancelled
      expect(mockCompiler.cancel).toHaveBeenCalledWith(firstRequestId);

      // Advance to trigger second compilation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Second compilation should be called
      expect(mockCompiler.compile).toHaveBeenCalledTimes(2);
    });
  });

  describe('success handling', () => {
    it('onSuccess updates store to success state', () => {
      renderHook(() => usePreview('# Hello'));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the onSuccess callback from the compile call
      const compileCall = mockCompiler.compile.mock.calls[0];
      expect(compileCall).toBeDefined();
      const { requestId, onSuccess } = compileCall![1];

      // Simulate successful compilation response
      const successResponse: CompileResponseSuccess = {
        id: requestId,
        ok: true,
        code: 'compiled code',
        frontmatter: { title: 'Hello' },
      };

      act(() => {
        onSuccess(successResponse);
      });

      // Store should be in success state
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result.code).toBe('compiled code');
        expect(state.state.result.frontmatter).toEqual({ title: 'Hello' });
      }

      // lastSuccessfulRender should be updated
      expect(state.lastSuccessfulRender).toEqual({
        ok: true,
        code: 'compiled code',
        frontmatter: { title: 'Hello' },
      });
    });
  });

  describe('error handling', () => {
    it('onError updates store to error state', () => {
      renderHook(() => usePreview('# Invalid'));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the onError callback
      const compileCall = mockCompiler.compile.mock.calls[0];
      expect(compileCall).toBeDefined();
      const { onError } = compileCall![1];

      // Simulate error response
      const errors: CompileError[] = [
        { message: 'Syntax error', line: 1, column: 5 },
      ];

      act(() => {
        onError(errors);
      });

      // Store should be in error state
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      if (state.state.status === 'error') {
        expect(state.state.errors).toEqual(errors);
      }
    });

    it('lastSuccessfulRender preserved on error', () => {
      // First, set up a successful render
      const successResult: CompileSuccess = {
        ok: true,
        code: 'previous success',
        frontmatter: { title: 'Test' },
      };
      usePreviewStore.getState().setSuccess(successResult);

      // Now render hook with invalid source
      renderHook(() => usePreview('# Invalid'));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the onError callback
      const compileCall = mockCompiler.compile.mock.calls[0];
      expect(compileCall).toBeDefined();
      const { onError } = compileCall![1];

      // Simulate error
      act(() => {
        onError([{ message: 'Error' }]);
      });

      // lastSuccessfulRender should still be preserved
      const state = usePreviewStore.getState();
      expect(state.state.status).toBe('error');
      expect(state.lastSuccessfulRender).toEqual(successResult);
    });
  });

  describe('stale response handling', () => {
    it('stale responses are ignored (requestId check)', () => {
      const { rerender } = renderHook(
        ({ source }) => usePreview(source),
        { initialProps: { source: '# First' } }
      );

      // Advance to trigger first compilation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the first request's callbacks
      const firstCallArgs = mockCompiler.compile.mock.calls[0];
      expect(firstCallArgs).toBeDefined();
      const firstRequestId = firstCallArgs![1].requestId;
      const firstOnSuccess = firstCallArgs![1].onSuccess;

      // Change source - this should cancel the first request
      rerender({ source: '# Second' });

      // Advance to trigger second compilation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the second request's callbacks
      const secondCallArgs = mockCompiler.compile.mock.calls[1];
      expect(secondCallArgs).toBeDefined();
      const secondRequestId = secondCallArgs![1].requestId;
      const secondOnSuccess = secondCallArgs![1].onSuccess;

      // Now simulate the FIRST (stale) response arriving AFTER the second was started
      act(() => {
        firstOnSuccess({
          id: firstRequestId,
          ok: true,
          code: 'stale result',
          frontmatter: {},
        });
      });

      // The stale response should be ignored - store should NOT be updated with stale data
      // Since the requestId was cleared when cancel was called, the check in onSuccess fails
      let state = usePreviewStore.getState();
      // State should still be compiling (waiting for second request)
      expect(state.state.status).toBe('compiling');

      // Now simulate the second (current) response
      act(() => {
        secondOnSuccess({
          id: secondRequestId,
          ok: true,
          code: 'current result',
          frontmatter: {},
        });
      });

      // Now the store should be updated with the current result
      state = usePreviewStore.getState();
      expect(state.state.status).toBe('success');
      if (state.state.status === 'success') {
        expect(state.state.result.code).toBe('current result');
      }
    });
  });

  describe('unmount cleanup', () => {
    it('unmount cleanup (clears timeout, cancels request, terminates worker)', () => {
      const { unmount } = renderHook(() => usePreview('# Hello'));

      // Advance past debounce to create compiler and start compilation
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Get the request ID
      const compileCall = mockCompiler.compile.mock.calls[0];
      expect(compileCall).toBeDefined();
      const requestId = compileCall![1].requestId;

      // Now unmount
      unmount();

      // Should cancel the pending request
      expect(mockCompiler.cancel).toHaveBeenCalledWith(requestId);

      // Should terminate the worker
      expect(mockCompiler.terminate).toHaveBeenCalled();
    });

    it('unmount clears pending debounce timeout', () => {
      const { unmount } = renderHook(() => usePreview('# Hello'));

      // Don't advance timers - debounce is still pending
      expect(createMDXCompiler).not.toHaveBeenCalled();

      // Unmount while debounce is pending
      unmount();

      // Now advance past debounce time
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Compiler should NOT have been created because timeout was cleared
      expect(createMDXCompiler).not.toHaveBeenCalled();
    });
  });

  describe('state transitions', () => {
    it('transitions to compiling state before calling worker', () => {
      renderHook(() => usePreview('# Hello'));

      // Store compile mock to capture the moment it's called
      let stateAtCompileTime: ReturnType<typeof usePreviewStore.getState> | null = null;
      mockCompiler = {
        compile: vi.fn(() => {
          stateAtCompileTime = usePreviewStore.getState();
        }),
        cancel: vi.fn(),
        terminate: vi.fn(),
      };

      // Need to re-mock createMDXCompiler to use our modified mockCompiler
      (createMDXCompiler as Mock).mockImplementation(() => mockCompiler);

      // Render fresh hook
      const { rerender } = renderHook(
        ({ source }) => usePreview(source),
        { initialProps: { source: '# First' } }
      );

      // Change source to trigger new compilation
      rerender({ source: '# Test' });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // At the moment compile was called, state should be compiling
      expect(stateAtCompileTime).not.toBeNull();
      expect(stateAtCompileTime!.state.status).toBe('compiling');
    });
  });

  describe('setScrollRatio', () => {
    it('setScrollRatio updates scroll ratio in store', () => {
      const { result } = renderHook(() => usePreview(''));

      act(() => {
        result.current.setScrollRatio(0.5);
      });

      expect(result.current.scrollRatio).toBe(0.5);
      expect(usePreviewStore.getState().scrollRatio).toBe(0.5);
    });
  });

  describe('enabled option', () => {
    it('enabled=true (default) triggers compilation', () => {
      renderHook(() => usePreview('# Hello'));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Compiler should be created and compile should be called
      expect(createMDXCompiler).toHaveBeenCalled();
      expect(mockCompiler.compile).toHaveBeenCalledWith(
        '# Hello',
        expect.objectContaining({
          requestId: expect.any(String),
        })
      );
    });

    it('enabled=false skips compilation', () => {
      const options: UsePreviewOptions = { enabled: false };
      renderHook(() => usePreview('# Hello', options));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Compiler should NOT be created when disabled
      expect(createMDXCompiler).not.toHaveBeenCalled();
    });

    it('enabled=false maintains last state (does not clear)', () => {
      // First, set up a successful render in the store
      const successResult: CompileSuccess = {
        ok: true,
        code: 'previous success',
        frontmatter: { title: 'Test' },
      };
      usePreviewStore.getState().setSuccess(successResult);

      // Now render hook with enabled=false
      const options: UsePreviewOptions = { enabled: false };
      const { result } = renderHook(() => usePreview('# New Source', options));

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // No compilation should occur
      expect(createMDXCompiler).not.toHaveBeenCalled();

      // Last successful render should be preserved
      expect(result.current.lastSuccessfulRender).toEqual(successResult);
      expect(result.current.state.status).toBe('success');
    });

    it('switching enabled from false to true triggers compilation', () => {
      const { rerender } = renderHook(
        ({ source, enabled }) => usePreview(source, { enabled }),
        { initialProps: { source: '# Hello', enabled: false } }
      );

      // Advance past debounce - should not compile when disabled
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(createMDXCompiler).not.toHaveBeenCalled();

      // Enable compilation
      rerender({ source: '# Hello', enabled: true });

      // Advance past debounce - should compile now
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(createMDXCompiler).toHaveBeenCalled();
      expect(mockCompiler.compile).toHaveBeenCalledWith(
        '# Hello',
        expect.objectContaining({
          requestId: expect.any(String),
        })
      );
    });

    it('switching enabled from true to false pauses compilation', () => {
      const { rerender } = renderHook(
        ({ source, enabled }) => usePreview(source, { enabled }),
        { initialProps: { source: '# First', enabled: true } }
      );

      // Advance past debounce - should compile
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(createMDXCompiler).toHaveBeenCalled();
      expect(mockCompiler.compile).toHaveBeenCalledTimes(1);

      // Disable and change source
      rerender({ source: '# Second', enabled: false });

      // Advance past debounce - should NOT compile
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(mockCompiler.compile).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('source changes while disabled do not trigger compilation', () => {
      const { rerender } = renderHook(
        ({ source, enabled }) => usePreview(source, { enabled }),
        { initialProps: { source: '# First', enabled: false } }
      );

      // Change source multiple times while disabled
      rerender({ source: '# Second', enabled: false });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      rerender({ source: '# Third', enabled: false });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // No compilation should have occurred
      expect(createMDXCompiler).not.toHaveBeenCalled();
    });
  });
});

describe('usePreviewStatus', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePreviewStore.getState().reset();
  });

  it('returns idle status initially', () => {
    const { result } = renderHook(() => usePreviewStatus());
    expect(result.current).toBe('idle');
  });

  it('returns compiling status when compiling', () => {
    usePreviewStore.getState().startCompiling();
    const { result } = renderHook(() => usePreviewStatus());
    expect(result.current).toBe('compiling');
  });

  it('returns success status after successful compilation', () => {
    usePreviewStore.getState().setSuccess({
      ok: true,
      code: 'test',
      frontmatter: {},
    });
    const { result } = renderHook(() => usePreviewStatus());
    expect(result.current).toBe('success');
  });

  it('returns error status after failed compilation', () => {
    usePreviewStore.getState().setError([{ message: 'Error' }]);
    const { result } = renderHook(() => usePreviewStatus());
    expect(result.current).toBe('error');
  });

  it('updates when store status changes', () => {
    const { result } = renderHook(() => usePreviewStatus());
    expect(result.current).toBe('idle');

    act(() => {
      usePreviewStore.getState().startCompiling();
    });
    expect(result.current).toBe('compiling');

    act(() => {
      usePreviewStore.getState().setSuccess({
        ok: true,
        code: 'test',
        frontmatter: {},
      });
    });
    expect(result.current).toBe('success');
  });
});
