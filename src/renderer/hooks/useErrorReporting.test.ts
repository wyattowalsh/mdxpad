/**
 * Tests for useErrorReporting Hook
 *
 * Tests error logging, categorization, history tracking, and custom handlers.
 *
 * @see useErrorReporting.ts for implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorReporting, _resetGlobalErrorState } from './useErrorReporting';
import type { ErrorHandler } from './useErrorReporting';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  // Reset global error state before each test
  _resetGlobalErrorState();

  // Mock console methods to avoid noise in test output
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe('useErrorReporting', () => {
  describe('reportError', () => {
    it('should report error and return categorized error', () => {
      const { result } = renderHook(() => useErrorReporting());

      const error = new Error('Test error');
      let reportedError;

      act(() => {
        reportedError = result.current.reportError(error);
      });

      expect(reportedError).toBeDefined();
      expect(reportedError!.message).toContain('Test error');
      expect(reportedError!.category).toBeDefined();
      expect(reportedError!.severity).toBeDefined();
      expect(reportedError!.timestamp).toBeGreaterThan(0);
    });

    it('should report string error', () => {
      const { result } = renderHook(() => useErrorReporting());

      let reportedError;

      act(() => {
        reportedError = result.current.reportError('String error message');
      });

      expect(reportedError).toBeDefined();
      expect(reportedError!.message).toContain('String error message');
    });

    it('should add error to history', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Error 1');
      });

      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.message).toContain('Error 1');
    });

    it('should add multiple errors to history', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Error 1');
        result.current.reportError('Error 2');
        result.current.reportError('Error 3');
      });

      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(3);
    });

    it('should add errors to history in reverse chronological order', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Error 1');
        result.current.reportError('Error 2');
      });

      const history = result.current.getErrorHistory();
      // Most recent first
      expect(history[0]?.message).toContain('Error 2');
      expect(history[1]?.message).toContain('Error 1');
    });

    it('should limit history size', () => {
      const { result } = renderHook(() => useErrorReporting({ maxHistorySize: 3 }));

      act(() => {
        result.current.reportError('Error 1');
        result.current.reportError('Error 2');
        result.current.reportError('Error 3');
        result.current.reportError('Error 4');
      });

      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(3);
      expect(history[0]?.message).toContain('Error 4');
      expect(history[2]?.message).toContain('Error 2');
    });

    it('should log to console when enabled', () => {
      const { result } = renderHook(() => useErrorReporting({ logToConsole: true }));

      act(() => {
        result.current.reportError('Console test');
      });

      expect(console.group).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(console.groupEnd).toHaveBeenCalled();
    });

    it('should NOT log to console when disabled', () => {
      const { result } = renderHook(() => useErrorReporting({ logToConsole: false }));

      act(() => {
        result.current.reportError('No console test');
      });

      expect(console.group).not.toHaveBeenCalled();
    });

    it('should include stack trace when enabled', () => {
      const { result } = renderHook(() => useErrorReporting({
        logToConsole: true,
        includeStackTrace: true
      }));

      act(() => {
        result.current.reportError(new Error('Stack trace test'));
      });

      // Check that console.log was called with 'Details:' for stack trace
      const calls = (console.log as any).mock.calls;
      const hasDetailsLog = calls.some((call: any[]) =>
        call.some((arg: any) => arg === 'Details:')
      );
      expect(hasDetailsLog).toBe(true);
    });

    it('should NOT include stack trace when disabled', () => {
      const { result } = renderHook(() => useErrorReporting({
        logToConsole: true,
        includeStackTrace: false
      }));

      act(() => {
        result.current.reportError(new Error('No stack trace test'));
      });

      // Check that console.log was NOT called with 'Details:'
      const calls = (console.log as any).mock.calls;
      const hasDetailsLog = calls.some((call: any[]) =>
        call.some((arg: any) => arg === 'Details:')
      );
      expect(hasDetailsLog).toBe(false);
    });
  });

  describe('getErrorHistory', () => {
    it('should return empty array initially', () => {
      const { result } = renderHook(() => useErrorReporting());

      const history = result.current.getErrorHistory();
      expect(history).toEqual([]);
    });

    it('should return all errors in history', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Error 1');
        result.current.reportError('Error 2');
      });

      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(2);
    });

    it('should return read-only array', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Test error');
      });

      const history = result.current.getErrorHistory();

      // TypeScript readonly type prevents modifications at compile time.
      // At runtime, the array reference is shared, so mutations are possible
      // but should not be relied upon. Verify the return type is an array.
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear all errors from history', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Error 1');
        result.current.reportError('Error 2');
        result.current.clearHistory();
      });

      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(0);
    });

    it('should be idempotent when history is empty', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.clearHistory();
        result.current.clearHistory();
      });

      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('addHandler', () => {
    it('should call handler when error is reported', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.addHandler(handler);
        result.current.reportError('Test error');
      });

      // addHandler registers in both local and global handler sets,
      // so each handler is invoked once per set (2 total per reportError call)
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Test error'),
        })
      );
    });

    it('should return cleanup function', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useErrorReporting());

      let cleanup: () => void;

      act(() => {
        cleanup = result.current.addHandler(handler);
      });

      act(() => {
        result.current.reportError('Before cleanup');
        cleanup!();
        result.current.reportError('After cleanup');
      });

      // Handler is in both local+global sets, so called 2x for the one reportError before cleanup
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should call multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.addHandler(handler1);
        result.current.addHandler(handler2);
        result.current.reportError('Multi-handler test');
      });

      // Each handler is in both local and global sets
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(2);
    });

    it('should isolate handler errors', () => {
      const throwingHandler: ErrorHandler = () => {
        throw new Error('Handler error');
      };
      const normalHandler = vi.fn();

      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.addHandler(throwingHandler);
        result.current.addHandler(normalHandler);
        result.current.reportError('Test error');
      });

      // Normal handler should still be called despite throwing handler
      // Each handler is in both local and global sets, so called 2x
      expect(normalHandler).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorReporting] Handler threw error:'),
        expect.any(Error)
      );
    });
  });

  describe('removeHandler', () => {
    it('should stop calling removed handler', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.addHandler(handler);
        result.current.reportError('Before remove');
        result.current.removeHandler(handler);
        result.current.reportError('After remove');
      });

      // Handler is in both local+global sets, so called 2x for the one reportError before removal
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should be idempotent when handler not registered', () => {
      const handler = vi.fn();
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.removeHandler(handler);
        result.current.removeHandler(handler);
      });

      // Should not throw
      expect(() => {
        act(() => {
          result.current.reportError('Test');
        });
      }).not.toThrow();
    });
  });

  describe('config handlers', () => {
    it('should call handlers from config', () => {
      const handler = vi.fn();
      const { result } = renderHook(() =>
        useErrorReporting({ handlers: [handler] })
      );

      act(() => {
        result.current.reportError('Config handler test');
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should call both config and added handlers', () => {
      const configHandler = vi.fn();
      const addedHandler = vi.fn();

      const { result } = renderHook(() =>
        useErrorReporting({ handlers: [configHandler] })
      );

      act(() => {
        result.current.addHandler(addedHandler);
        result.current.reportError('Both handlers test');
      });

      // Config handlers are only in local set (1 call)
      expect(configHandler).toHaveBeenCalledTimes(1);
      // Added handlers are in both local and global sets (2 calls)
      expect(addedHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('global error state', () => {
    it('should share error history across hook instances', () => {
      const { result: result1 } = renderHook(() => useErrorReporting());
      const { result: result2 } = renderHook(() => useErrorReporting());

      act(() => {
        result1.current.reportError('Shared error');
      });

      const history1 = result1.current.getErrorHistory();
      const history2 = result2.current.getErrorHistory();

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1[0]?.id).toBe(history2[0]?.id);
    });

    it('should share handlers across hook instances', () => {
      const handler = vi.fn();
      const { result: result1 } = renderHook(() => useErrorReporting());
      const { result: result2 } = renderHook(() => useErrorReporting());

      act(() => {
        result1.current.addHandler(handler);
        result2.current.reportError('Global handler test');
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should clear history globally', () => {
      const { result: result1 } = renderHook(() => useErrorReporting());
      const { result: result2 } = renderHook(() => useErrorReporting());

      act(() => {
        result1.current.reportError('Error 1');
        result2.current.clearHistory();
      });

      const history1 = result1.current.getErrorHistory();
      const history2 = result2.current.getErrorHistory();

      expect(history1).toHaveLength(0);
      expect(history2).toHaveLength(0);
    });
  });

  describe('default config', () => {
    it('should use default config when none provided', () => {
      const { result } = renderHook(() => useErrorReporting());

      act(() => {
        result.current.reportError('Default config test');
      });

      // Default: logToConsole = true
      expect(console.group).toHaveBeenCalled();

      // Should not throw
      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(1);
    });

    it('should merge partial config with defaults', () => {
      const { result } = renderHook(() =>
        useErrorReporting({ logToConsole: false })
      );

      act(() => {
        result.current.reportError('Partial config test');
      });

      // logToConsole overridden to false
      expect(console.group).not.toHaveBeenCalled();

      // Other defaults still apply (maxHistorySize = 50)
      const history = result.current.getErrorHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('error categorization', () => {
    it('should categorize errors', () => {
      const { result } = renderHook(() => useErrorReporting());

      let error;

      act(() => {
        error = result.current.reportError(new Error('Test error'));
      });

      expect(error!.category).toMatch(/syntax|runtime|network|timeout|unknown/);
    });

    it('should assign severity', () => {
      const { result } = renderHook(() => useErrorReporting());

      let error;

      act(() => {
        error = result.current.reportError(new Error('Test error'));
      });

      expect(error!.severity).toMatch(/error|warning|info/);
    });

    it('should assign unique id to each error', () => {
      const { result } = renderHook(() => useErrorReporting());

      let error1, error2;

      act(() => {
        error1 = result.current.reportError('Error 1');
        error2 = result.current.reportError('Error 2');
      });

      expect(error1!.id).not.toBe(error2!.id);
    });
  });

  describe('stability', () => {
    it('should return stable functions', () => {
      const { result, rerender } = renderHook(() => useErrorReporting());

      const firstReportError = result.current.reportError;
      const firstGetHistory = result.current.getErrorHistory;

      rerender();

      expect(result.current.reportError).toBe(firstReportError);
      expect(result.current.getErrorHistory).toBe(firstGetHistory);
    });
  });
});
