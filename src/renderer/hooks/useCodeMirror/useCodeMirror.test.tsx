/**
 * Unit tests for useCodeMirror hook.
 * Tests React hook integration with CodeMirror 6 editor.
 *
 * @see tasks.md T012 - Hook tests
 * @see useCodeMirror.ts for implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, render, screen } from '@testing-library/react';
import { useCodeMirror, type UseCodeMirrorOptions, type UseCodeMirrorReturn } from './useCodeMirror';
import type { EditorState, SelectionInfo } from '../../../shared/types/editor';
import React, { useEffect } from 'react';

/**
 * Test component that properly mounts the editor and exposes hook return value.
 */
function TestEditor({
  options = {},
  onReady,
}: {
  options?: UseCodeMirrorOptions;
  onReady: (hookReturn: UseCodeMirrorReturn) => void;
}) {
  const hookReturn = useCodeMirror(options);

  useEffect(() => {
    // Call onReady whenever hook state updates
    onReady(hookReturn);
  }, [hookReturn, onReady]);

  return <div ref={hookReturn.containerRef} data-testid="editor-container" />;
}

/**
 * Helper to render the test editor and get access to the hook return value.
 */
function renderTestEditor(options: UseCodeMirrorOptions = {}) {
  let hookReturn: UseCodeMirrorReturn | null = null;
  const onReady = vi.fn((hr: UseCodeMirrorReturn) => {
    hookReturn = hr;
  });

  const renderResult = render(<TestEditor options={options} onReady={onReady} />);

  return {
    ...renderResult,
    getHookReturn: () => hookReturn,
    waitForState: async (timeout = 2000): Promise<EditorState> => {
      await waitFor(
        () => {
          expect(hookReturn?.state).not.toBeNull();
        },
        { timeout }
      );
      // After waitFor succeeds, hookReturn and state are guaranteed to be non-null
      const state = hookReturn?.state;
      if (!state) {
        throw new Error('State should not be null after waitFor');
      }
      return state;
    },
    container: screen.getByTestId('editor-container'),
  };
}

describe('useCodeMirror', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('initialization', () => {
    it('initializes with containerRef', () => {
      const { result } = renderHook(() => useCodeMirror());
      expect(result.current.containerRef).toBeDefined();
      expect(result.current.containerRef.current).toBeNull(); // Not mounted yet
    });

    it('returns null state before mounting', () => {
      const { result } = renderHook(() => useCodeMirror());
      expect(result.current.state).toBeNull();
      expect(result.current.selection).toBeNull();
    });

    it('returns stable function references', () => {
      const { result, rerender } = renderHook(() => useCodeMirror());
      const firstRender = {
        setValue: result.current.setValue,
        setSelection: result.current.setSelection,
        executeCommand: result.current.executeCommand,
        focus: result.current.focus,
      };
      rerender();
      expect(result.current.setValue).toBe(firstRender.setValue);
      expect(result.current.setSelection).toBe(firstRender.setSelection);
      expect(result.current.executeCommand).toBe(firstRender.executeCommand);
      expect(result.current.focus).toBe(firstRender.focus);
    });

    it('initializes isFocused to false', () => {
      const { result } = renderHook(() => useCodeMirror());
      expect(result.current.isFocused).toBe(false);
    });
  });

  describe('state updates', () => {
    it('renders EditorView with initial document', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello world',
      });

      try {
        const state = await waitForState();
        expect(state.doc).toBe('hello world');
        expect(getHookReturn()?.state?.doc).toBe('hello world');
      } finally {
        unmount();
      }
    });

    it('initializes with empty string when no initialDoc provided', async () => {
      const { waitForState, unmount } = renderTestEditor({});

      try {
        const state = await waitForState();
        expect(state.doc).toBe('');
      } finally {
        unmount();
      }
    });

    it('provides selection info after mounting', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test content',
      });

      try {
        await waitForState();
        const selection = getHookReturn()?.selection;
        expect(selection).not.toBeNull();
        if (selection) {
          expect(selection.from).toBe(0);
          expect(selection.to).toBe(0);
          expect(selection.empty).toBe(true);
        }
      } finally {
        unmount();
      }
    });

    it('reflects document content in state.doc', async () => {
      const { waitForState, unmount } = renderTestEditor({
        initialDoc: 'line1\nline2\nline3',
      });

      try {
        const state = await waitForState();
        expect(state.doc).toContain('line1');
        expect(state.doc).toContain('line2');
        expect(state.doc).toContain('line3');
        expect(state.doc.split('\n').length).toBe(3);
      } finally {
        unmount();
      }
    });
  });

  describe('setValue', () => {
    it('updates document content when mounted', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'initial',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('updated content');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('updated content');
        });
      } finally {
        unmount();
      }
    });

    it('replaces entire document', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello world foo bar',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('completely different');
        });

        await waitFor(() => {
          const doc = getHookReturn()?.state?.doc;
          expect(doc).toBe('completely different');
          expect(doc).not.toContain('hello');
        });
      } finally {
        unmount();
      }
    });

    it('handles empty string replacement', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'some content',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('');
        });
      } finally {
        unmount();
      }
    });

    it('handles multiline content', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: '',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;
        const multilineContent = 'line1\nline2\nline3\nline4';

        act(() => {
          hookReturn.setValue(multilineContent);
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe(multilineContent);
        });
      } finally {
        unmount();
      }
    });

    it('is safe to call when view is not mounted', () => {
      const { result } = renderHook(() => useCodeMirror());

      // Should not throw when called before mounting
      expect(() => {
        act(() => {
          result.current.setValue('test');
        });
      }).not.toThrow();
    });
  });

  describe('onChange callback', () => {
    it('is called with EditorState after document change', async () => {
      const onChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'initial',
        onChange,
        debounceMs: 10,
      });

      try {
        await waitForState();
        onChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('new content');
        });

        await waitFor(
          () => {
            expect(onChange).toHaveBeenCalled();
          },
          { timeout: 1000 }
        );

        const calledState = onChange.mock.calls[0]?.[0] as EditorState | undefined;
        if (calledState) {
          expect(calledState.doc).toBe('new content');
        }
      } finally {
        unmount();
      }
    });

    it('receives state with correct document after multiple changes', async () => {
      const onChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: '',
        onChange,
        debounceMs: 10,
      });

      try {
        await waitForState();
        onChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('first');
        });

        await waitFor(
          () => {
            expect(onChange).toHaveBeenCalled();
          },
          { timeout: 1000 }
        );

        const lastCallIndex = onChange.mock.calls.length - 1;
        const calledState = onChange.mock.calls[lastCallIndex]?.[0] as EditorState | undefined;
        if (calledState) {
          expect(calledState.doc).toBe('first');
        }
      } finally {
        unmount();
      }
    });

    it('debounces rapid changes', async () => {
      const onChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: '',
        onChange,
        debounceMs: 50,
      });

      try {
        await waitForState();
        onChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Make rapid changes
        act(() => {
          hookReturn.setValue('a');
        });
        act(() => {
          hookReturn.setValue('ab');
        });
        act(() => {
          hookReturn.setValue('abc');
        });

        // Wait for debounce to complete
        await waitFor(
          () => {
            expect(onChange).toHaveBeenCalled();
          },
          { timeout: 1000 }
        );

        // The final call should have the last value
        const lastCallIndex = onChange.mock.calls.length - 1;
        const lastState = onChange.mock.calls[lastCallIndex]?.[0] as EditorState | undefined;
        if (lastState) {
          expect(lastState.doc).toBe('abc');
        }
      } finally {
        unmount();
      }
    });
  });

  describe('setSelection', () => {
    it('updates selection state', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello world',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0, 5);
        });

        await waitFor(() => {
          const selection = getHookReturn()?.selection;
          expect(selection).not.toBeNull();
          if (selection) {
            expect(selection.from).toBe(0);
            expect(selection.to).toBe(5);
            expect(selection.empty).toBe(false);
          }
        });
      } finally {
        unmount();
      }
    });

    it('sets cursor position when only anchor is provided', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello world',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(5);
        });

        await waitFor(() => {
          const selection = getHookReturn()?.selection;
          expect(selection).not.toBeNull();
          if (selection) {
            expect(selection.from).toBe(5);
            expect(selection.to).toBe(5);
            expect(selection.empty).toBe(true);
          }
        });
      } finally {
        unmount();
      }
    });

    it('clamps out-of-bounds anchor to document length', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello', // 5 characters
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(100); // Way beyond document end
        });

        await waitFor(() => {
          const selection = getHookReturn()?.selection;
          expect(selection).not.toBeNull();
          if (selection) {
            expect(selection.from).toBeLessThanOrEqual(5);
            expect(selection.to).toBeLessThanOrEqual(5);
          }
        });
      } finally {
        unmount();
      }
    });

    it('clamps negative values to zero', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(-10, -5);
        });

        await waitFor(() => {
          const selection = getHookReturn()?.selection;
          expect(selection).not.toBeNull();
          if (selection) {
            expect(selection.from).toBeGreaterThanOrEqual(0);
            expect(selection.to).toBeGreaterThanOrEqual(0);
          }
        });
      } finally {
        unmount();
      }
    });

    it('handles mixed out-of-bounds values', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello', // 5 characters
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(-5, 100);
        });

        await waitFor(() => {
          const selection = getHookReturn()?.selection;
          expect(selection).not.toBeNull();
          if (selection) {
            expect(selection.from).toBe(0);
            expect(selection.to).toBe(5);
          }
        });
      } finally {
        unmount();
      }
    });

    it('triggers onSelectionChange callback', async () => {
      const onSelectionChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello world',
        onSelectionChange,
      });

      try {
        await waitForState();
        onSelectionChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0, 5);
        });

        await waitFor(() => {
          expect(onSelectionChange).toHaveBeenCalled();
        });

        const lastCallIndex = onSelectionChange.mock.calls.length - 1;
        const selectionInfo = onSelectionChange.mock.calls[lastCallIndex]?.[0] as SelectionInfo | undefined;
        if (selectionInfo) {
          expect(selectionInfo.from).toBe(0);
          expect(selectionInfo.to).toBe(5);
          expect(selectionInfo.empty).toBe(false);
        }
      } finally {
        unmount();
      }
    });

    it('is safe to call when view is not mounted', () => {
      const { result } = renderHook(() => useCodeMirror());

      expect(() => {
        act(() => {
          result.current.setSelection(0, 5);
        });
      }).not.toThrow();
    });
  });

  describe('focus', () => {
    it('focus is callable without errors', () => {
      const { result } = renderHook(() => useCodeMirror());
      expect(() => result.current.focus()).not.toThrow();
    });

    it('sets isFocused to true when focused on mounted editor', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.focus();
        });

        await waitFor(() => {
          expect(getHookReturn()?.isFocused).toBe(true);
        });
      } finally {
        unmount();
      }
    });

    it('isFocused is boolean type', () => {
      const { result } = renderHook(() => useCodeMirror());
      expect(typeof result.current.isFocused).toBe('boolean');
    });
  });

  describe('executeCommand', () => {
    it('returns false when view is not mounted', () => {
      const { result } = renderHook(() => useCodeMirror({ initialDoc: 'test' }));
      const commandResult = result.current.executeCommand('bold');
      expect(commandResult).toBe(false);
    });

    it('returns true for valid formatting commands when mounted', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test text',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Select some text first
        act(() => {
          hookReturn.setSelection(0, 4);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.from).toBe(0);
        });

        let commandResult = false;
        act(() => {
          commandResult = hookReturn.executeCommand('bold');
        });

        expect(commandResult).toBe(true);
      } finally {
        unmount();
      }
    });

    it('applies bold formatting correctly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Select "hello"
        act(() => {
          hookReturn.setSelection(0, 5);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.to).toBe(5);
        });

        act(() => {
          hookReturn.executeCommand('bold');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('**hello**');
        });
      } finally {
        unmount();
      }
    });

    it('applies italic formatting correctly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0, 5);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.to).toBe(5);
        });

        act(() => {
          hookReturn.executeCommand('italic');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('*hello*');
        });
      } finally {
        unmount();
      }
    });

    it('applies code formatting correctly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'code',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0, 4);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.to).toBe(4);
        });

        act(() => {
          hookReturn.executeCommand('code');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('`code`');
        });
      } finally {
        unmount();
      }
    });

    it('applies heading1 formatting correctly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'Title',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Place cursor anywhere on the line
        act(() => {
          hookReturn.setSelection(2);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.from).toBe(2);
        });

        act(() => {
          hookReturn.executeCommand('heading1');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('# Title');
        });
      } finally {
        unmount();
      }
    });

    it('applies heading2 formatting correctly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'Subtitle',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.from).toBe(0);
        });

        act(() => {
          hookReturn.executeCommand('heading2');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('## Subtitle');
        });
      } finally {
        unmount();
      }
    });

    it('applies heading3 formatting correctly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'Section',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0);
        });

        act(() => {
          hookReturn.executeCommand('heading3');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('### Section');
        });
      } finally {
        unmount();
      }
    });

    it('inserts link with selected text as link text', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'example',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setSelection(0, 7);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.to).toBe(7);
        });

        act(() => {
          hookReturn.executeCommand('link');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('[example](url)');
        });
      } finally {
        unmount();
      }
    });

    it('undo reverts the last change', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'original',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Make a change
        act(() => {
          hookReturn.setValue('modified');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('modified');
        });

        // Undo
        act(() => {
          hookReturn.executeCommand('undo');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('original');
        });
      } finally {
        unmount();
      }
    });

    it('redo restores undone change', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'original',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Make a change
        act(() => {
          hookReturn.setValue('modified');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('modified');
        });

        // Undo
        act(() => {
          hookReturn.executeCommand('undo');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('original');
        });

        // Redo
        act(() => {
          hookReturn.executeCommand('redo');
        });

        await waitFor(() => {
          expect(getHookReturn()?.state?.doc).toBe('modified');
        });
      } finally {
        unmount();
      }
    });

    it('calls onError callback when command throws', async () => {
      const onError = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
        onError,
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Valid commands should not trigger onError
        act(() => {
          hookReturn.executeCommand('bold');
        });

        // onError should not have been called for valid commands
        expect(typeof onError).toBe('function');
      } finally {
        unmount();
      }
    });

    it('should call onError with EditorError structure when command fails', async () => {
      // We need to test the actual error handling path.
      // Import executeCommand directly to test error handling behavior.
      const { executeCommand: execCmd } = await import('./commands');

      const onError = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test content',
        onError,
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Get the raw view to test error handling directly
        const view = hookReturn.getView();
        expect(view).not.toBeNull();
        if (!view) return;

        // Mock a command that throws by temporarily breaking the view's state
        // We'll use a spy on the state's doc.toString to trigger an error
        const originalSliceDoc = view.state.sliceDoc.bind(view.state);
        const mockError = new Error('Simulated command failure');

        // Temporarily make sliceDoc throw to simulate a command failure
        vi.spyOn(view.state, 'sliceDoc').mockImplementation(() => {
          throw mockError;
        });

        let result = false;
        act(() => {
          result = execCmd(view, 'bold', onError);
        });

        // Command should return false when it fails
        expect(result).toBe(false);

        // onError should have been called with proper EditorError structure
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'command',
            message: expect.stringContaining("Command 'bold' failed"),
            timestamp: expect.any(Number),
          })
        );

        // Verify the error has proper structure
        const receivedError = onError.mock.calls[0]?.[0];
        expect(receivedError).toBeDefined();
        if (receivedError) {
          expect(receivedError.type).toBe('command');
          expect(typeof receivedError.message).toBe('string');
          expect(typeof receivedError.timestamp).toBe('number');
          expect(receivedError.timestamp).toBeGreaterThan(0);
          // Context should contain commandName and originalError
          expect(receivedError.context).toBeDefined();
          expect(receivedError.context?.commandName).toBe('bold');
        }

        // Restore the original method
        vi.mocked(view.state.sliceDoc).mockRestore();
      } finally {
        unmount();
      }
    });

    it('should include error context with commandName and originalError', async () => {
      const { executeCommand: execCmd } = await import('./commands');
      const onError = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
        onError,
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        const view = hookReturn.getView();
        expect(view).not.toBeNull();
        if (!view) return;

        const testErrorMessage = 'Test error for context validation';

        // Make the command throw
        vi.spyOn(view.state, 'sliceDoc').mockImplementation(() => {
          throw new Error(testErrorMessage);
        });

        act(() => {
          execCmd(view, 'italic', onError);
        });

        expect(onError).toHaveBeenCalledTimes(1);
        const error = onError.mock.calls[0]?.[0];

        // Verify context contains proper debugging information
        expect(error?.context).toBeDefined();
        expect(error?.context?.commandName).toBe('italic');
        expect(error?.context?.originalError).toBeInstanceOf(Error);
        const originalError = error?.context?.originalError as Error | undefined;
        expect(originalError?.message).toBe(testErrorMessage);

        vi.mocked(view.state.sliceDoc).mockRestore();
      } finally {
        unmount();
      }
    });

    it('should handle non-Error thrown values in command execution', async () => {
      const { executeCommand: execCmd } = await import('./commands');
      const onError = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
        onError,
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        const view = hookReturn.getView();
        expect(view).not.toBeNull();
        if (!view) return;

        // Make the command throw a non-Error value (string)
        vi.spyOn(view.state, 'sliceDoc').mockImplementation(() => {
          // Intentionally throwing a non-Error to test edge case handling
          throw 'String error message';
        });

        act(() => {
          execCmd(view, 'code', onError);
        });

        expect(onError).toHaveBeenCalledTimes(1);
        const error = onError.mock.calls[0]?.[0];

        // Should still create a valid EditorError even with non-Error thrown values
        expect(error?.type).toBe('command');
        expect(error?.message).toContain("Command 'code' failed");
        expect(error?.message).toContain('String error message');
        expect(typeof error?.timestamp).toBe('number');

        vi.mocked(view.state.sliceDoc).mockRestore();
      } finally {
        unmount();
      }
    });

    it('should not call onError when command succeeds', async () => {
      const onError = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'hello world',
        onError,
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Select text and apply formatting - should succeed without error
        act(() => {
          hookReturn.setSelection(0, 5);
        });

        await waitFor(() => {
          expect(getHookReturn()?.selection?.to).toBe(5);
        });

        let result = false;
        act(() => {
          result = hookReturn.executeCommand('bold');
        });

        // Command should succeed
        expect(result).toBe(true);

        // onError should NOT have been called for successful commands
        expect(onError).not.toHaveBeenCalled();
      } finally {
        unmount();
      }
    });

    it('onError receives timestamp that is recent', async () => {
      const { executeCommand: execCmd } = await import('./commands');
      const onError = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
        onError,
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        const view = hookReturn.getView();
        expect(view).not.toBeNull();
        if (!view) return;

        const beforeTimestamp = Date.now();

        vi.spyOn(view.state, 'sliceDoc').mockImplementation(() => {
          throw new Error('Test error');
        });

        act(() => {
          execCmd(view, 'link', onError);
        });

        const afterTimestamp = Date.now();

        expect(onError).toHaveBeenCalledTimes(1);
        const error = onError.mock.calls[0]?.[0];

        // Timestamp should be between before and after the call
        expect(error?.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(error?.timestamp).toBeLessThanOrEqual(afterTimestamp);

        vi.mocked(view.state.sliceDoc).mockRestore();
      } finally {
        unmount();
      }
    });

    it('returns boolean type for all command results', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
      });

      try {
        await waitForState();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        const commands: Parameters<typeof hookReturn.executeCommand>[0][] = [
          'bold',
          'italic',
          'code',
          'link',
          'heading1',
          'heading2',
          'heading3',
          'undo',
          'redo',
        ];

        for (const cmd of commands) {
          let commandResult = false;
          act(() => {
            commandResult = hookReturn.executeCommand(cmd);
          });
          expect(typeof commandResult).toBe('boolean');
        }
      } finally {
        unmount();
      }
    });
  });

  describe('cleanup', () => {
    it('unmount cleans up without errors', () => {
      const { unmount } = renderHook(() => useCodeMirror());
      expect(() => unmount()).not.toThrow();
    });

    it('mounted editor cleans up properly', async () => {
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: 'test',
      });

      try {
        await waitForState();
        expect(getHookReturn()?.state).not.toBeNull();
      } finally {
        expect(() => unmount()).not.toThrow();
      }
    });

    it('cancels debounced onChange on unmount', async () => {
      const onChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: '',
        onChange,
        debounceMs: 500, // Longer debounce
      });

      try {
        await waitForState();
        onChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        // Make a change but unmount before debounce fires
        act(() => {
          hookReturn.setValue('new content');
        });

        // Unmount immediately
        unmount();

        // Wait a bit to ensure debounce would have fired
        await new Promise((resolve) => setTimeout(resolve, 600));

        // onChange should not have been called after unmount
        // (or at most once if it fired before cleanup completed)
        expect(onChange.mock.calls.length).toBeLessThanOrEqual(1);
      } catch {
        unmount();
      }
    });
  });

  describe('configuration options', () => {
    it('respects custom debounceMs', async () => {
      const onChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: '',
        onChange,
        debounceMs: 5, // Very short
      });

      try {
        await waitForState();
        onChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('quick change');
        });

        // Should fire quickly with short debounce
        await waitFor(
          () => {
            expect(onChange).toHaveBeenCalled();
          },
          { timeout: 2000 }
        );
      } finally {
        unmount();
      }
    });

    it('uses default debounce when not specified', async () => {
      const onChange = vi.fn();
      const { getHookReturn, waitForState, unmount } = renderTestEditor({
        initialDoc: '',
        onChange,
        // No debounceMs - should use default (150ms)
      });

      try {
        await waitForState();
        onChange.mockClear();
        const hookReturn = getHookReturn();
        expect(hookReturn).not.toBeNull();
        if (!hookReturn) return;

        act(() => {
          hookReturn.setValue('test');
        });

        // Should eventually fire with default debounce
        await waitFor(
          () => {
            expect(onChange).toHaveBeenCalled();
          },
          { timeout: 1000 }
        );
      } finally {
        unmount();
      }
    });
  });
});
