/**
 * Tests for Document Store.
 *
 * Tests document state management including new document, open document,
 * content updates, dirty tracking, save operations, and reset functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDocumentStore,
  selectFilePath,
  selectFileName,
  selectContent,
  selectIsDirty,
  selectIsUntitled,
  selectLastKnownMtime,
} from './document-store';
import type { DocumentFileHandle, DocumentId } from '@shared/types/document';
import { INITIAL_DOCUMENT_STATE } from '@shared/types/document';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a mock document file handle for testing.
 */
function createMockFileHandle(overrides?: Partial<DocumentFileHandle>): DocumentFileHandle {
  return {
    fileId: 'test-uuid-1234' as DocumentId,
    filePath: '/Users/test/documents/test.mdx',
    mtime: 1704067200000, // 2024-01-01T00:00:00.000Z
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('useDocumentStore', () => {
  beforeEach(() => {
    // Reset store state to initial values before each test
    useDocumentStore.setState(INITIAL_DOCUMENT_STATE);
  });

  describe('initial state', () => {
    it('should start with initial document state', () => {
      const state = useDocumentStore.getState();

      expect(state.fileId).toBeNull();
      expect(state.filePath).toBeNull();
      expect(state.fileName).toBe('Untitled');
      expect(state.content).toBe('');
      expect(state.savedContent).toBe('');
      expect(state.isDirty).toBe(false);
      expect(state.lastKnownMtime).toBeNull();
    });
  });

  describe('newDocument', () => {
    it('should create untitled document', () => {
      // First set some non-initial state
      useDocumentStore.setState({
        fileId: 'existing-id' as DocumentId,
        filePath: '/some/path.mdx',
        fileName: 'path.mdx',
        content: 'existing content',
        savedContent: 'existing content',
        isDirty: false,
        lastKnownMtime: 12345,
      });

      // Create new document
      useDocumentStore.getState().newDocument();
      const state = useDocumentStore.getState();

      expect(state.fileId).toBeNull();
      expect(state.filePath).toBeNull();
      expect(state.fileName).toBe('Untitled');
      expect(state.content).toBe('');
      expect(state.savedContent).toBe('');
      expect(state.isDirty).toBe(false);
      expect(state.lastKnownMtime).toBeNull();
    });

    it('should reset dirty document to untitled', () => {
      // Set dirty state
      useDocumentStore.setState({
        fileId: null,
        filePath: null,
        fileName: 'Untitled',
        content: 'unsaved changes',
        savedContent: '',
        isDirty: true,
        lastKnownMtime: null,
      });

      useDocumentStore.getState().newDocument();
      const state = useDocumentStore.getState();

      expect(state.isDirty).toBe(false);
      expect(state.content).toBe('');
    });
  });

  describe('openDocument', () => {
    it('should set all state correctly', () => {
      const handle = createMockFileHandle();
      const content = '# Hello World\n\nThis is MDX content.';

      useDocumentStore.getState().openDocument(handle, content);
      const state = useDocumentStore.getState();

      expect(state.fileId).toBe(handle.fileId);
      expect(state.filePath).toBe(handle.filePath);
      expect(state.fileName).toBe('test.mdx');
      expect(state.content).toBe(content);
      expect(state.savedContent).toBe(content);
      expect(state.isDirty).toBe(false);
      expect(state.lastKnownMtime).toBe(handle.mtime);
    });

    it('should extract filename from path correctly', () => {
      const handle = createMockFileHandle({
        filePath: '/very/deep/nested/path/to/document.mdx',
      });

      useDocumentStore.getState().openDocument(handle, '');
      const state = useDocumentStore.getState();

      expect(state.fileName).toBe('document.mdx');
    });

    it('should handle Windows-style paths', () => {
      const handle = createMockFileHandle({
        filePath: 'C:\\Users\\test\\Documents\\file.mdx',
      });

      useDocumentStore.getState().openDocument(handle, '');
      const state = useDocumentStore.getState();

      expect(state.fileName).toBe('file.mdx');
    });

    it('should handle filename without path', () => {
      const handle = createMockFileHandle({
        filePath: 'just-a-file.mdx',
      });

      useDocumentStore.getState().openDocument(handle, '');
      const state = useDocumentStore.getState();

      expect(state.fileName).toBe('just-a-file.mdx');
    });

    it('should clear dirty state when opening a document', () => {
      // First set a dirty state
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'unsaved changes',
        isDirty: true,
      });

      const handle = createMockFileHandle();
      useDocumentStore.getState().openDocument(handle, 'new content');
      const state = useDocumentStore.getState();

      expect(state.isDirty).toBe(false);
    });
  });

  describe('setContent', () => {
    it('should update content', () => {
      useDocumentStore.getState().setContent('new content');
      const state = useDocumentStore.getState();

      expect(state.content).toBe('new content');
    });

    it('should set isDirty true when content differs from savedContent', () => {
      // Start with saved content
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'original',
        savedContent: 'original',
        isDirty: false,
      });

      useDocumentStore.getState().setContent('modified');
      const state = useDocumentStore.getState();

      expect(state.isDirty).toBe(true);
    });

    it('should set isDirty false when content matches savedContent', () => {
      // Start with modified content
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'modified',
        savedContent: 'original',
        isDirty: true,
      });

      // Change back to match saved
      useDocumentStore.getState().setContent('original');
      const state = useDocumentStore.getState();

      expect(state.isDirty).toBe(false);
    });

    it('should keep isDirty false when content already matches savedContent', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'same',
        savedContent: 'same',
        isDirty: false,
      });

      useDocumentStore.getState().setContent('same');
      const state = useDocumentStore.getState();

      expect(state.isDirty).toBe(false);
    });
  });

  describe('markSaved', () => {
    it('should update savedContent and clear isDirty without handle', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'new content',
        savedContent: '',
        isDirty: true,
      });

      useDocumentStore.getState().markSaved();
      const state = useDocumentStore.getState();

      expect(state.savedContent).toBe('new content');
      expect(state.isDirty).toBe(false);
    });

    it('should update filePath and mtime when handle is provided', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'new content',
        isDirty: true,
      });

      const handle = createMockFileHandle({
        fileId: 'new-file-id' as DocumentId,
        filePath: '/Users/test/saved-file.mdx',
        mtime: 1704153600000,
      });

      useDocumentStore.getState().markSaved(handle);
      const state = useDocumentStore.getState();

      expect(state.fileId).toBe('new-file-id');
      expect(state.filePath).toBe('/Users/test/saved-file.mdx');
      expect(state.fileName).toBe('saved-file.mdx');
      expect(state.lastKnownMtime).toBe(1704153600000);
      expect(state.isDirty).toBe(false);
    });

    it('should keep existing file info when handle is not provided', () => {
      const initialHandle = createMockFileHandle();
      useDocumentStore.getState().openDocument(initialHandle, 'initial');
      useDocumentStore.getState().setContent('modified');

      // Save without handle (same file)
      useDocumentStore.getState().markSaved();
      const state = useDocumentStore.getState();

      // File info should be unchanged
      expect(state.fileId).toBe(initialHandle.fileId);
      expect(state.filePath).toBe(initialHandle.filePath);
      expect(state.lastKnownMtime).toBe(initialHandle.mtime);

      // But content should be saved
      expect(state.savedContent).toBe('modified');
      expect(state.isDirty).toBe(false);
    });
  });

  describe('reset', () => {
    it('should return to initial state', () => {
      // Set complex state
      const handle = createMockFileHandle();
      useDocumentStore.getState().openDocument(handle, 'some content');
      useDocumentStore.getState().setContent('modified content');

      // Verify state is not initial
      expect(useDocumentStore.getState().isDirty).toBe(true);
      expect(useDocumentStore.getState().filePath).not.toBeNull();

      // Reset
      useDocumentStore.getState().reset();
      const state = useDocumentStore.getState();

      expect(state.fileId).toBeNull();
      expect(state.filePath).toBeNull();
      expect(state.fileName).toBe('Untitled');
      expect(state.content).toBe('');
      expect(state.savedContent).toBe('');
      expect(state.isDirty).toBe(false);
      expect(state.lastKnownMtime).toBeNull();
    });
  });

  describe('updateMtime', () => {
    it('should update lastKnownMtime', () => {
      const handle = createMockFileHandle({ mtime: 1000 });
      useDocumentStore.getState().openDocument(handle, 'content');

      useDocumentStore.getState().updateMtime(2000);
      const state = useDocumentStore.getState();

      expect(state.lastKnownMtime).toBe(2000);
    });

    it('should update mtime on untitled document', () => {
      // Start with initial state (untitled)
      expect(useDocumentStore.getState().lastKnownMtime).toBeNull();

      useDocumentStore.getState().updateMtime(12345);
      const state = useDocumentStore.getState();

      expect(state.lastKnownMtime).toBe(12345);
    });
  });

  describe('isDirty computation', () => {
    it('should be true when content !== savedContent', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'modified',
        savedContent: 'original',
        isDirty: true, // manually set for consistency
      });

      // Use setContent to trigger proper isDirty computation
      useDocumentStore.getState().setContent('modified');
      expect(useDocumentStore.getState().isDirty).toBe(true);
    });

    it('should be false when content === savedContent', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'same',
        savedContent: 'same',
      });

      useDocumentStore.getState().setContent('same');
      expect(useDocumentStore.getState().isDirty).toBe(false);
    });

    it('should handle empty strings correctly', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: '',
        savedContent: '',
      });

      expect(useDocumentStore.getState().isDirty).toBe(false);

      useDocumentStore.getState().setContent('x');
      expect(useDocumentStore.getState().isDirty).toBe(true);

      useDocumentStore.getState().setContent('');
      expect(useDocumentStore.getState().isDirty).toBe(false);
    });

    it('should handle whitespace differences', () => {
      useDocumentStore.setState({
        ...INITIAL_DOCUMENT_STATE,
        content: 'hello',
        savedContent: 'hello',
      });

      useDocumentStore.getState().setContent('hello ');
      expect(useDocumentStore.getState().isDirty).toBe(true);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useDocumentStore.setState(INITIAL_DOCUMENT_STATE);
  });

  describe('selectFilePath', () => {
    it('should return null for untitled document', () => {
      expect(selectFilePath(useDocumentStore.getState())).toBeNull();
    });

    it('should return filePath after opening document', () => {
      const handle = createMockFileHandle({ filePath: '/test/path.mdx' });
      useDocumentStore.getState().openDocument(handle, '');

      expect(selectFilePath(useDocumentStore.getState())).toBe('/test/path.mdx');
    });
  });

  describe('selectFileName', () => {
    it('should return "Untitled" for new document', () => {
      expect(selectFileName(useDocumentStore.getState())).toBe('Untitled');
    });

    it('should return filename after opening document', () => {
      const handle = createMockFileHandle({ filePath: '/test/myfile.mdx' });
      useDocumentStore.getState().openDocument(handle, '');

      expect(selectFileName(useDocumentStore.getState())).toBe('myfile.mdx');
    });
  });

  describe('selectContent', () => {
    it('should return empty string initially', () => {
      expect(selectContent(useDocumentStore.getState())).toBe('');
    });

    it('should return content after setContent', () => {
      useDocumentStore.getState().setContent('hello world');

      expect(selectContent(useDocumentStore.getState())).toBe('hello world');
    });
  });

  describe('selectIsDirty', () => {
    it('should return false initially', () => {
      expect(selectIsDirty(useDocumentStore.getState())).toBe(false);
    });

    it('should return true after content change', () => {
      useDocumentStore.getState().setContent('changed');

      expect(selectIsDirty(useDocumentStore.getState())).toBe(true);
    });

    it('should return false after markSaved', () => {
      useDocumentStore.getState().setContent('changed');
      useDocumentStore.getState().markSaved();

      expect(selectIsDirty(useDocumentStore.getState())).toBe(false);
    });
  });

  describe('selectIsUntitled', () => {
    it('should return true for new document', () => {
      expect(selectIsUntitled(useDocumentStore.getState())).toBe(true);
    });

    it('should return false after opening document', () => {
      const handle = createMockFileHandle();
      useDocumentStore.getState().openDocument(handle, '');

      expect(selectIsUntitled(useDocumentStore.getState())).toBe(false);
    });

    it('should return true after reset', () => {
      const handle = createMockFileHandle();
      useDocumentStore.getState().openDocument(handle, '');
      useDocumentStore.getState().reset();

      expect(selectIsUntitled(useDocumentStore.getState())).toBe(true);
    });
  });

  describe('selectLastKnownMtime', () => {
    it('should return null initially', () => {
      expect(selectLastKnownMtime(useDocumentStore.getState())).toBeNull();
    });

    it('should return mtime after opening document', () => {
      const handle = createMockFileHandle({ mtime: 999999 });
      useDocumentStore.getState().openDocument(handle, '');

      expect(selectLastKnownMtime(useDocumentStore.getState())).toBe(999999);
    });

    it('should return updated mtime after updateMtime', () => {
      const handle = createMockFileHandle({ mtime: 1000 });
      useDocumentStore.getState().openDocument(handle, '');
      useDocumentStore.getState().updateMtime(2000);

      expect(selectLastKnownMtime(useDocumentStore.getState())).toBe(2000);
    });
  });
});
