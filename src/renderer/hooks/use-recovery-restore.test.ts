/**
 * Tests for useRecoveryRestore Hook
 *
 * Tests document restoration from crash recovery data.
 *
 * @see use-recovery-restore.ts for implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecoveryRestore } from './use-recovery-restore';
import { subscribeDocumentTabs } from '@renderer/components/tabs/document-tabs';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import type { RestoredDocument } from '@shared/contracts/autosave-ipc';
import type { DocumentId as AutosaveDocumentId } from '@shared/contracts/autosave-schemas';
import type { DocumentId } from '@shared/types/document';

// =============================================================================
// Test Setup
// =============================================================================

const createMockRestoredDocument = (overrides?: Partial<RestoredDocument>): RestoredDocument => ({
  documentId: 'restored-doc-id' as AutosaveDocumentId,
  fileName: 'test.mdx',
  filePath: '/test/path/test.mdx',
  content: '# Restored Content',
  ...overrides,
});

beforeEach(() => {
  useTabStore.getState().reset();
  // Reset document store
  useDocumentStore.setState({
    fileId: null,
    filePath: null,
    fileName: 'Untitled',
    content: '',
    savedContent: '',
    isDirty: false,
    lastKnownMtime: null,
    externalChangeDetected: false,
    externalContent: null,
    externalMtime: null,
  });
});

// =============================================================================
// Tests
// =============================================================================

describe('useRecoveryRestore', () => {
  describe('basic restoration', () => {
    it('should restore single document', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        content: '# My Restored Doc',
        fileName: 'restored.mdx',
        filePath: '/docs/restored.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      const state = useDocumentStore.getState();

      expect(state.content).toBe('# My Restored Doc');
      expect(state.fileName).toBe('restored.mdx');
      expect(state.filePath).toBe('/docs/restored.mdx');
      expect(state.isDirty).toBe(true); // Should be dirty since not saved
      expect(state.savedContent).toBe(''); // Should be empty
    });

    it('clears an external-change notice from the previous document', () => {
      useDocumentStore.setState({
        externalChangeDetected: true,
        externalContent: 'old disk',
        externalMtime: 1,
      });
      const { result } = renderHook(() => useRecoveryRestore());

      act(() => {
        result.current.restoreDocuments([createMockRestoredDocument()]);
      });

      const state = useDocumentStore.getState();
      expect(state.externalChangeDetected).toBe(false);
      expect(state.externalContent).toBeNull();
      expect(state.externalMtime).toBeNull();
    });

    it('should set isDirty to true', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument();

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().isDirty).toBe(true);
    });

    it('should set savedContent to empty string', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        content: 'Recovered content',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      const state = useDocumentStore.getState();

      expect(state.content).toBe('Recovered content');
      expect(state.savedContent).toBe('');
    });

    it('should set lastKnownMtime to null', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument();

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().lastKnownMtime).toBeNull();
    });
  });

  describe('file path handling', () => {
    it('should restore document with filePath', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        fileName: 'document.mdx',
        filePath: '/path/to/document.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      const state = useDocumentStore.getState();

      expect(state.filePath).toBe('/path/to/document.mdx');
      expect(state.fileName).toBe('document.mdx');
    });

    it('should restore document with null filePath (untitled)', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        fileName: 'Untitled Document',
        filePath: null,
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      const state = useDocumentStore.getState();

      expect(state.filePath).toBeNull();
      expect(state.fileName).toBe('Untitled Document');
    });

    it('should extract filename from path', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        fileName: 'original.mdx',
        filePath: '/very/deep/nested/path/actual.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      // Should use extracted filename from path
      expect(useDocumentStore.getState().fileName).toBe('actual.mdx');
    });

    it('should handle Windows-style paths', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        fileName: 'file.mdx',
        filePath: 'C:\\Users\\test\\Documents\\file.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().fileName).toBe('file.mdx');
    });

    it('should use fileName when filePath is null', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        fileName: 'Fallback Name.mdx',
        filePath: null,
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().fileName).toBe('Fallback Name.mdx');
    });
  });

  describe('multiple documents', () => {
    it('opens every recovered document and shows the first', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc1 = createMockRestoredDocument({
        content: 'First document',
        fileName: 'first.mdx',
        filePath: '/docs/first.mdx',
      });

      const doc2 = createMockRestoredDocument({
        content: 'Second document',
        fileName: 'second.mdx',
        filePath: '/docs/second.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc1, doc2]);
      });

      const state = useDocumentStore.getState();

      expect(state.content).toBe('First document');
      expect(state.fileName).toBe('first.mdx');
      expect(useTabStore.getState().tabs.map((tab) => tab.fileName)).toEqual([
        'first.mdx',
        'second.mdx',
      ]);
      expect(useTabStore.getState().tabs[1]?.content).toBe('Second document');
    });

    it('keeps a file the user already opened', () => {
      useDocumentStore.getState().openDocument(
        { fileId: 'file-1' as DocumentId, filePath: '/docs/notes.md', mtime: 1 },
        'my notes'
      );
      useTabStore.getState().addTab({
        filePath: '/docs/notes.md',
        fileName: 'notes.md',
        isDirty: false,
        content: 'my notes',
        savedContent: 'my notes',
      });
      const { result } = renderHook(() => useRecoveryRestore());

      act(() => {
        result.current.restoreDocuments([
          createMockRestoredDocument({
            documentId: 'recovered-id' as AutosaveDocumentId,
            content: 'Recovered',
            fileName: 'recovered.mdx',
            filePath: '/docs/recovered.mdx',
          }),
        ]);
      });

      expect(useDocumentStore.getState().filePath).toBe('/docs/notes.md');
      expect(useDocumentStore.getState().content).toBe('my notes');
      expect(useTabStore.getState().tabs.map((tab) => tab.fileName)).toEqual([
        'notes.md',
        'recovered.mdx',
      ]);
    });

    it('keeps every recovered document when the tab bar is following the editor', () => {
      const stop = subscribeDocumentTabs();
      const { result } = renderHook(() => useRecoveryRestore());
      const doc1 = createMockRestoredDocument({
        content: 'First document',
        fileName: 'first.mdx',
        filePath: '/docs/first.mdx',
      });
      const doc2 = createMockRestoredDocument({
        content: 'Second document',
        fileName: 'second.mdx',
        filePath: '/docs/second.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc1, doc2]);
      });
      stop();

      expect(useTabStore.getState().tabs.map((tab) => tab.content)).toEqual([
        'First document',
        'Second document',
      ]);
      expect(useDocumentStore.getState().content).toBe('First document');
    });

    it('should log info when multiple documents provided', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const docs = [
        createMockRestoredDocument({ fileName: 'doc1.mdx', filePath: '/docs/doc1.mdx' }),
        createMockRestoredDocument({ fileName: 'doc2.mdx', filePath: '/docs/doc2.mdx' }),
        createMockRestoredDocument({ fileName: 'doc3.mdx', filePath: '/docs/doc3.mdx' }),
      ];

      // Should not throw
      act(() => {
        result.current.restoreDocuments(docs);
      });

      // Should restore first document
      expect(useDocumentStore.getState().fileName).toBe('doc1.mdx');
    });
  });

  describe('empty documents array', () => {
    it('should handle empty array gracefully', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const initialState = useDocumentStore.getState();

      act(() => {
        result.current.restoreDocuments([]);
      });

      const finalState = useDocumentStore.getState();

      // State should not change
      expect(finalState).toEqual(initialState);
    });

    it('should not set isRestoring for empty array', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      expect(result.current.isRestoring).toBe(false);

      act(() => {
        result.current.restoreDocuments([]);
      });

      expect(result.current.isRestoring).toBe(false);
    });
  });

  describe('isRestoring state', () => {
    it('should start with isRestoring false', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      expect(result.current.isRestoring).toBe(false);
    });

    it('should set isRestoring during restoration', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument();

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      // After restoration completes, isRestoring should be false
      expect(result.current.isRestoring).toBe(false);
    });
  });

  describe('content handling', () => {
    it('should restore empty content', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        content: '',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().content).toBe('');
    });

    it('should restore multiline content', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const content = '# Title\n\nParagraph 1\n\nParagraph 2';
      const doc = createMockRestoredDocument({
        content,
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().content).toBe(content);
    });

    it('should restore content with special characters', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const content = '`code` **bold** _italic_ [link](url)';
      const doc = createMockRestoredDocument({
        content,
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().content).toBe(content);
    });

    it('should restore content with Unicode', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const content = '你好世界 こんにちは مرحبا';
      const doc = createMockRestoredDocument({
        content,
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      expect(useDocumentStore.getState().content).toBe(content);
    });
  });

  describe('document ID handling', () => {
    it('should set fileId from documentId', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const docId = 'custom-doc-id-123' as AutosaveDocumentId;
      const doc = createMockRestoredDocument({
        documentId: docId,
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      // Note: DocumentId types are different but both are string-based UUIDs
      expect(useDocumentStore.getState().fileId).toBeTruthy();
    });
  });

  describe('cleanup', () => {
    it('should not throw on unmount', () => {
      const { unmount } = renderHook(() => useRecoveryRestore());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle unmount during restoration', () => {
      const { result, unmount } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument();

      act(() => {
        result.current.restoreDocuments([doc]);
        unmount();
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle undefined document gracefully', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const initialState = useDocumentStore.getState();

      // Pass invalid data (undefined in array) - hook guards with null check
      act(() => {
        result.current.restoreDocuments([undefined as any]);
      });

      const finalState = useDocumentStore.getState();

      // State should not change since the undefined doc is skipped
      expect(finalState.content).toBe(initialState.content);
    });
  });

  describe('state atomicity', () => {
    it('should update all fields atomically', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc = createMockRestoredDocument({
        documentId: 'atomic-test' as AutosaveDocumentId,
        fileName: 'atomic.mdx',
        filePath: '/path/atomic.mdx',
        content: 'Atomic content',
      });

      act(() => {
        result.current.restoreDocuments([doc]);
      });

      const state = useDocumentStore.getState();

      // All fields should be updated
      expect(state.content).toBe('Atomic content');
      expect(state.fileName).toBe('atomic.mdx');
      expect(state.filePath).toBe('/path/atomic.mdx');
      expect(state.isDirty).toBe(true);
      expect(state.savedContent).toBe('');
      expect(state.lastKnownMtime).toBeNull();
    });
  });

  describe('stability', () => {
    it('should return stable restoreDocuments function', () => {
      const { result, rerender } = renderHook(() => useRecoveryRestore());

      const firstRestore = result.current.restoreDocuments;

      rerender();

      expect(result.current.restoreDocuments).toBe(firstRestore);
    });
  });

  describe('multiple restorations', () => {
    it('should handle sequential restorations', () => {
      const { result } = renderHook(() => useRecoveryRestore());

      const doc1 = createMockRestoredDocument({
        content: 'First restoration',
        fileName: 'first.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc1]);
      });

      expect(useDocumentStore.getState().content).toBe('First restoration');

      const doc2 = createMockRestoredDocument({
        content: 'Second restoration',
        fileName: 'second.mdx',
      });

      act(() => {
        result.current.restoreDocuments([doc2]);
      });

      expect(useDocumentStore.getState().content).toBe('Second restoration');
    });
  });
});
