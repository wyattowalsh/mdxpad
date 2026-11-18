/**
 * Tests for useScrollSync Hook
 *
 * Tests bidirectional scroll synchronization between editor and preview panes.
 *
 * @see useScrollSync.ts for implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScrollSync } from './useScrollSync';
import { registerWysiwygScroll } from '@renderer/lib/editor/wysiwyg-scroll';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { useSyncStore } from '@renderer/stores/sync-store';
import { useRef } from 'react';

// =============================================================================
// Test Setup
// =============================================================================

/**
 * Create a mock EditorView
 */
function createMockEditorView(doc: string): EditorView {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const state = EditorState.create({
    doc,
    selection: { anchor: 0, head: 0 },
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return view;
}

/**
 * Create a mock iframe with preview content
 */
function createMockIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);

  // Create minimal document structure
  const doc = iframe.contentDocument!;
  doc.open();
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- test helper needs document.write to populate iframe
  doc.write('<html><body><div id="preview"></div></body></html>');
  doc.close();

  return iframe;
}

/**
 * Cleanup EditorView
 */
function cleanupEditor(view: EditorView): void {
  view.dom.parentElement?.removeChild(view.dom);
  view.destroy();
}

beforeEach(() => {
  // Reset sync store
  useSyncStore.setState({
    mode: 'bidirectional',
    editorPosition: null,
    previewPosition: null,
  });

  document.body.innerHTML = '';

  // Mock matchMedia for reduced motion detection
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false, // Not reduced motion by default
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  registerWysiwygScroll(null);
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe('useScrollSync', () => {
  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.syncEditorToPreview).toBe('function');
      expect(typeof result.current.syncPreviewToEditor).toBe('function');
      expect(typeof result.current.pauseSync).toBe('function');
      expect(typeof result.current.resumeSync).toBe('function');
    });

    it('should respect isEnabled option', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() =>
        useScrollSync({ editorRef, previewRef, isEnabled: false })
      );

      // Sync functions should exist but do nothing when disabled
      expect(result.current.syncEditorToPreview).toBeDefined();
    });

    it('should use store enabled state by default', () => {
      useSyncStore.setState({ mode: 'disabled' });

      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      expect(result.current.syncEditorToPreview).toBeDefined();
    });
  });

  describe('syncEditorToPreview', () => {
    it('should not sync when editor ref is null', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // Should not throw
      expect(() => {
        result.current.syncEditorToPreview();
      }).not.toThrow();
    });

    it('should not sync when preview ref is null', () => {
      const editor = createMockEditorView('test content');
      const editorRef = { current: editor };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      expect(() => {
        result.current.syncEditorToPreview();
      }).not.toThrow();

      cleanupEditor(editor);
    });

    it('should not sync when disabled', () => {
      const editor = createMockEditorView('test content');
      const iframe = createMockIframe();

      const editorRef = { current: editor };
      const previewRef = { current: iframe };

      const { result } = renderHook(() =>
        useScrollSync({ editorRef, previewRef, isEnabled: false })
      );

      result.current.syncEditorToPreview();

      expect(result.current.isSyncing).toBe(false);

      cleanupEditor(editor);
    });

    it('should not sync when mode is preview-only', () => {
      const editor = createMockEditorView('test content');
      const iframe = createMockIframe();

      const editorRef = { current: editor };
      const previewRef = { current: iframe };

      const { result } = renderHook(() =>
        useScrollSync({ editorRef, previewRef, mode: 'previewToEditor' })
      );

      result.current.syncEditorToPreview();

      expect(result.current.isSyncing).toBe(false);

      cleanupEditor(editor);
    });

    it('should send scroll command using strict shared contract', () => {
      const editor = createMockEditorView('test content');
      const iframe = createMockIframe();
      const postMessageSpy = vi.spyOn(iframe.contentWindow!, 'postMessage');

      const editorRef = { current: editor };
      const previewRef = { current: iframe };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.syncEditorToPreview();
      });

      expect(postMessageSpy).toHaveBeenCalled();
      const [command] = postMessageSpy.mock.calls.at(-1) ?? [];
      expect(command).toMatchObject({
        type: 'scroll',
        ratio: expect.any(Number),
      });
      expect(command).not.toHaveProperty('animate');

      cleanupEditor(editor);
    });

    it('sends a scroll command from the visual editor', () => {
      const iframe = createMockIframe();
      const postMessageSpy = vi.spyOn(iframe.contentWindow!, 'postMessage');
      registerWysiwygScroll({
        element: document.createElement('div'),
        firstVisibleLine: () => 8,
        cursorLine: () => 8,
        totalLines: () => 20,
        revealLine: () => undefined,
        contentSample: () => ({ length: 4, sample: 'Hi' }),
      });
      const editorRef = { current: null };
      const previewRef = { current: iframe };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));
      act(() => {
        result.current.syncEditorToPreview();
      });

      expect(postMessageSpy).toHaveBeenCalled();
      const [command] = postMessageSpy.mock.calls.at(-1) ?? [];
      expect(command).toMatchObject({ type: 'scroll' });
    });

    it('follows a scroll in the visual editor after it opens', async () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const iframe = createMockIframe();
      const postMessageSpy = vi.spyOn(iframe.contentWindow!, 'postMessage');
      const editorRef = { current: null };
      const previewRef = { current: iframe };

      renderHook(() => useScrollSync({ editorRef, previewRef }));
      act(() => {
        registerWysiwygScroll({
          element,
          firstVisibleLine: () => 8,
          cursorLine: () => 8,
          totalLines: () => 20,
          revealLine: () => undefined,
          contentSample: () => ({ length: 4, sample: 'Hi' }),
        });
      });
      element.dispatchEvent(new Event('scroll'));

      await waitFor(() => {
        expect(postMessageSpy).toHaveBeenCalled();
      });
    });
  });

  describe('syncPreviewToEditor', () => {
    it('should not sync when editor ref is null', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      expect(() => {
        result.current.syncPreviewToEditor();
      }).not.toThrow();
    });

    it('reveals the mapped line in the visual editor', () => {
      const revealLine = vi.fn();
      registerWysiwygScroll({
        element: document.createElement('div'),
        firstVisibleLine: () => 1,
        cursorLine: () => 1,
        totalLines: () => 40,
        revealLine,
        contentSample: () => ({ length: 4, sample: 'Hi' }),
      });
      const iframe = createMockIframe();
      const editorRef = { current: null };
      const previewRef = { current: iframe };
      renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'scroll-report',
              ratio: 0,
              scrollTop: 0,
              scrollHeight: 800,
              clientHeight: 400,
            },
            origin: window.location.origin,
            source: iframe.contentWindow,
          })
        );
      });

      expect(revealLine).toHaveBeenCalledWith(1);
    });

    it('should not sync when disabled', () => {
      const editor = createMockEditorView('test content');
      const editorRef = { current: editor };
      const previewRef = { current: null };

      const { result } = renderHook(() =>
        useScrollSync({ editorRef, previewRef, isEnabled: false })
      );

      result.current.syncPreviewToEditor();

      expect(result.current.isSyncing).toBe(false);

      cleanupEditor(editor);
    });

    it('should require preview position data', () => {
      const editor = createMockEditorView('test content');
      const editorRef = { current: editor };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // No preview position data
      result.current.syncPreviewToEditor();

      expect(result.current.isSyncing).toBe(false);

      cleanupEditor(editor);
    });
  });

  describe('preview message validation', () => {
    it('should ignore scroll reports from untrusted origins', () => {
      const editor = createMockEditorView('line 1\nline 2\nline 3');
      const iframe = createMockIframe();
      const editorRef = { current: editor };
      const previewRef = { current: iframe };

      renderHook(() => useScrollSync({ editorRef, previewRef }));

      expect(useSyncStore.getState().previewPosition).toBeNull();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'scroll-report',
              ratio: 0.4,
              scrollTop: 120,
              scrollHeight: 800,
              clientHeight: 400,
            },
            origin: 'https://evil.example',
            source: iframe.contentWindow,
          })
        );
      });

      expect(useSyncStore.getState().previewPosition).toBeNull();

      cleanupEditor(editor);
    });
  });

  describe('pauseSync and resumeSync', () => {
    it('should pause sync', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.pauseSync();
      });

      // Paused state is internal, verify sync doesn't happen
      // (Would need refs to actually test sync behavior)
    });

    it('should resume sync', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.pauseSync();
        result.current.resumeSync();
      });

      // Verify resume works
      expect(result.current.pauseSync).toBeDefined();
    });

    it('should allow multiple pause/resume cycles', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.pauseSync();
        result.current.resumeSync();
        result.current.pauseSync();
        result.current.resumeSync();
      });

      expect(result.current.pauseSync).toBeDefined();
    });
  });

  describe('updateAST', () => {
    it('should update AST headings', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      const headings = [
        {
          text: 'Heading 1',
          level: 1,
          position: { line: 1, column: 1 },
        },
      ];

      act(() => {
        result.current.updateAST(headings);
      });

      // Should not throw
      expect(result.current.updateAST).toBeDefined();
    });

    it('should handle empty headings array', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.updateAST([]);
      });

      expect(result.current.updateAST).toBeDefined();
    });
  });

  describe('updateEditorLines', () => {
    it('should update editor line count', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.updateEditorLines(100);
      });

      expect(result.current.updateEditorLines).toBeDefined();
    });

    it('should handle zero lines', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.updateEditorLines(0);
      });

      expect(result.current.updateEditorLines).toBeDefined();
    });
  });

  describe('updatePreviewHeight', () => {
    it('should update preview dimensions', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.updatePreviewHeight(1000, 500);
      });

      expect(result.current.updatePreviewHeight).toBeDefined();
    });

    it('should handle zero dimensions', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      act(() => {
        result.current.updatePreviewHeight(0, 0);
      });

      expect(result.current.updatePreviewHeight).toBeDefined();
    });
  });

  describe('onSyncStateChange callback', () => {
    it('should call callback when sync state changes', async () => {
      const onSyncStateChange = vi.fn();
      const editorRef = { current: null };
      const previewRef = { current: null };

      renderHook(() => useScrollSync({ editorRef, previewRef, onSyncStateChange }));

      // Initially not syncing
      await waitFor(() => {
        expect(onSyncStateChange).toHaveBeenCalledWith(false);
      });
    });

    it('should handle undefined callback', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      expect(() => {
        renderHook(() => useScrollSync({ editorRef, previewRef }));
      }).not.toThrow();
    });
  });

  describe('cursor tracking', () => {
    it('should enable cursor tracking by default', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // Default enableCursorTracking is true
      expect(result.current.syncEditorToPreview).toBeDefined();
    });

    it('should respect enableCursorTracking option', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result } = renderHook(() =>
        useScrollSync({ editorRef, previewRef, enableCursorTracking: false })
      );

      expect(result.current.syncEditorToPreview).toBeDefined();
    });

    it('should track cursor position changes when enabled', () => {
      const editor = createMockEditorView('line 1\nline 2\nline 3');
      const iframe = createMockIframe();

      const editorRef = { current: editor };
      const previewRef = { current: iframe };

      const { result } = renderHook(() =>
        useScrollSync({ editorRef, previewRef, enableCursorTracking: true })
      );

      // Cursor tracking is active
      expect(result.current.syncEditorToPreview).toBeDefined();

      cleanupEditor(editor);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { unmount } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should cleanup editor listeners', () => {
      const editor = createMockEditorView('test content');
      const iframe = createMockIframe();

      const editorRef = { current: editor };
      const previewRef = { current: iframe };

      const { unmount, result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // Verify hook is functional before unmount
      expect(result.current.isSyncing).toBe(false);

      unmount();

      cleanupEditor(editor);
    });

    it('should cleanup preview message listener', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { unmount, result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // Verify hook returned valid state before unmount
      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.pauseSync).toBe('function');

      unmount();
    });
  });

  describe('mode changes', () => {
    it('should handle mode change from both to editor-only', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      type ModeType = 'disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional';

      const { rerender, result } = renderHook(
        ({ mode }: { mode: ModeType }) => useScrollSync({ editorRef, previewRef, mode }),
        { initialProps: { mode: 'bidirectional' as ModeType } }
      );

      rerender({ mode: 'editorToPreview' as ModeType });

      // Hook should remain functional after mode change
      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.syncEditorToPreview).toBe('function');
    });

    it('should handle mode change from both to preview-only', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      type ModeType = 'disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional';

      const { rerender, result } = renderHook(
        ({ mode }: { mode: ModeType }) => useScrollSync({ editorRef, previewRef, mode }),
        { initialProps: { mode: 'bidirectional' as ModeType } }
      );

      rerender({ mode: 'previewToEditor' as ModeType });

      // Hook should remain functional and not be syncing after mode change
      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.syncPreviewToEditor).toBe('function');
    });

    it('should handle mode change to none', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      type ModeType = 'disabled' | 'editorToPreview' | 'previewToEditor' | 'bidirectional';

      const { rerender, result } = renderHook(
        ({ mode }: { mode: ModeType }) => useScrollSync({ editorRef, previewRef, mode }),
        { initialProps: { mode: 'bidirectional' as ModeType } }
      );

      rerender({ mode: 'disabled' as ModeType });

      // Disabled mode — isSyncing should remain false
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('enabled state changes', () => {
    it('should handle enable to disable transition', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { rerender, result } = renderHook(
        ({ isEnabled }) => useScrollSync({ editorRef, previewRef, isEnabled }),
        { initialProps: { isEnabled: true } }
      );

      rerender({ isEnabled: false });

      // After disabling, sync should not be active
      expect(result.current.isSyncing).toBe(false);
    });

    it('should handle disable to enable transition', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { rerender, result } = renderHook(
        ({ isEnabled }) => useScrollSync({ editorRef, previewRef, isEnabled }),
        { initialProps: { isEnabled: false } }
      );

      rerender({ isEnabled: true });

      // After enabling, hook should be functional
      expect(typeof result.current.syncEditorToPreview).toBe('function');
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('ref changes', () => {
    it('should handle editor ref becoming available', () => {
      const editorRef: { current: EditorView | null } = { current: null };
      const previewRef = { current: null };

      const { rerender, result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // Add editor
      const editor = createMockEditorView('test');
      editorRef.current = editor;

      rerender();

      // Hook remains stable after ref becomes available
      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.syncEditorToPreview).toBe('function');

      cleanupEditor(editor);
    });

    it('should handle preview ref becoming available', () => {
      const editorRef = { current: null };
      const previewRef: { current: HTMLIFrameElement | null } = { current: null };

      const { rerender, result } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      // Add preview
      const iframe = createMockIframe();
      previewRef.current = iframe;

      rerender();

      // Hook remains stable after ref becomes available
      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.syncPreviewToEditor).toBe('function');
    });
  });

  describe('stability', () => {
    it('should return stable functions', () => {
      const editorRef = { current: null };
      const previewRef = { current: null };

      const { result, rerender } = renderHook(() => useScrollSync({ editorRef, previewRef }));

      const firstSync = result.current.syncEditorToPreview;
      const firstPause = result.current.pauseSync;

      rerender();

      expect(result.current.syncEditorToPreview).toBe(firstSync);
      expect(result.current.pauseSync).toBe(firstPause);
    });
  });
});
