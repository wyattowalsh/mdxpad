import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '@shared/contracts/autosave-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useFrontmatterStore } from '@renderer/stores/frontmatter-store';
import { registerLiveSourceText } from '@renderer/components/tabs/live-source-text';

import type { AppState } from './useAppState';
import { useAppDialogs } from './useAppDialogs';

const documentId = '123e4567-e89b-12d3-a456-426614174000' as DocumentId;

const conflict = {
  documentId,
  filePath: '/docs/note.mdx',
  recoveryContent: 'recovered text',
  diskContent: 'disk text',
  recoveryTimestamp: 1,
  diskModifiedAt: 2,
};

describe('useAppDialogs frontmatter', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useFrontmatterStore.getState().reset();
    registerLiveSourceText(null);
  });

  it('shows the new file frontmatter when the document changes', () => {
    useDocumentStore.setState({
      filePath: '/notes/a.md',
      content: '---\ntitle: A\n---\n',
    });
    useFrontmatterStore.getState().parseFromDocument('---\ntitle: A\n---\n');
    const content = { current: '---\ntitle: A\n---\n' };
    const state = {
      handleNotification: vi.fn(),
      recovery: { entries: [], handleDecision: vi.fn(), releaseRecovery: vi.fn() },
    } as unknown as AppState;

    renderHook(() => useAppDialogs({ ...state, documentContent: content.current } as AppState));

    act(() => {
      content.current = '---\ntitle: B\n---\n';
      useDocumentStore.setState({
        filePath: '/notes/b.md',
        content: content.current,
      });
    });

    const title = useFrontmatterStore
      .getState()
      .data?.fields.find((field) => field.name === 'title');
    expect(title?.value).toBe('B');
  });

  it('keeps editor keystrokes when a frontmatter field changes', () => {
    const stored = '---\ntitle: A\n---\nHello';
    useDocumentStore.setState({ filePath: '/notes/a.md', content: stored });
    useFrontmatterStore.getState().parseFromDocument(stored);
    registerLiveSourceText(() => '---\ntitle: A\n---\nHello!');
    const state = {
      documentContent: stored,
      handleNotification: vi.fn(),
      recovery: { entries: [], handleDecision: vi.fn(), releaseRecovery: vi.fn() },
    } as unknown as AppState;

    renderHook(() => useAppDialogs(state));
    act(() => {
      useFrontmatterStore.getState().updateField(['title'], 'B');
    });

    expect(useDocumentStore.getState().content).toContain('Hello!');
    expect(useDocumentStore.getState().content).toContain('title: B');
  });
});

describe('useAppDialogs conflict save as', () => {
  const previousMdxpad = window.mdxpad;

  afterEach(() => {
    window.mdxpad = previousMdxpad;
  });

  async function openConflict(state: AppState) {
    const { result } = renderHook(() => useAppDialogs(state));
    await act(async () => {
      await result.current.handleRecoveryDecision({
        action: 'accept',
        selectedIds: [documentId],
      });
    });
    return result;
  }

  it('saves the recovery copy and releases only that document', async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      value: { id: 'saved', path: '/docs/note-recovered.mdx', name: 'note-recovered.mdx' },
    }));
    window.mdxpad = {
      ...previousMdxpad,
      saveFileAs,
      recoveryPreview: async () => ({ ok: true as const, content: 'recovered text', conflict }),
    } as unknown as typeof window.mdxpad;
    const releaseRecovery = vi.fn(async () => true);
    const handleDecision = vi.fn();
    const handleNotification = vi.fn();
    const state = {
      documentContent: '',
      handleNotification,
      recovery: {
        entries: [{ documentId, hasConflict: true }],
        handleDecision,
        releaseRecovery,
      },
    } as unknown as AppState;

    const result = await openConflict(state);
    await act(async () => {
      await result.current.handleConflictResolve({
        choice: 'save-as',
        documentId,
        newPath: '',
      });
    });

    expect(saveFileAs).toHaveBeenCalledWith('recovered text', '/docs/note.mdx');
    expect(releaseRecovery).toHaveBeenCalledWith(documentId);
    expect(handleDecision).not.toHaveBeenCalled();
    expect(handleNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Saved recovery copy to note-recovered.mdx',
    });
    expect(result.current.activeConflict).toBeNull();
  });

  it('leaves recovery files in place when Save As is cancelled', async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'CANCELLED' as const },
    }));
    window.mdxpad = {
      ...previousMdxpad,
      saveFileAs,
      recoveryPreview: async () => ({ ok: true as const, content: 'recovered text', conflict }),
    } as unknown as typeof window.mdxpad;
    const releaseRecovery = vi.fn(async () => true);
    const state = {
      documentContent: '',
      handleNotification: vi.fn(),
      recovery: {
        entries: [{ documentId, hasConflict: true }],
        handleDecision: vi.fn(),
        releaseRecovery,
      },
    } as unknown as AppState;

    const result = await openConflict(state);
    await act(async () => {
      await result.current.handleConflictResolve({
        choice: 'save-as',
        documentId,
        newPath: '',
      });
    });

    expect(releaseRecovery).not.toHaveBeenCalled();
    expect(result.current.activeConflict?.recoveryContent).toBe('recovered text');
  });
});

describe('useAppDialogs conflict keep disk', () => {
  const previousMdxpad = window.mdxpad;
  const otherId = '223e4567-e89b-12d3-a456-426614174001' as DocumentId;

  afterEach(() => {
    window.mdxpad = previousMdxpad;
  });

  async function openConflict(state: AppState) {
    const { result } = renderHook(() => useAppDialogs(state));
    await act(async () => {
      await result.current.handleRecoveryDecision({
        action: 'accept',
        selectedIds: [documentId],
      });
    });
    return result;
  }

  it('discards only the conflicted recovery when keeping the disk copy', async () => {
    window.mdxpad = {
      ...previousMdxpad,
      recoveryPreview: async () => ({ ok: true as const, content: 'recovered text', conflict }),
    } as unknown as typeof window.mdxpad;
    const releaseRecovery = vi.fn(async () => true);
    const handleDecision = vi.fn();
    const state = {
      documentContent: '',
      handleNotification: vi.fn(),
      recovery: {
        entries: [
          { documentId, hasConflict: true },
          { documentId: otherId, hasConflict: false },
        ],
        handleDecision,
        releaseRecovery,
      },
    } as unknown as AppState;

    const result = await openConflict(state);
    await act(async () => {
      await result.current.handleConflictResolve({ choice: 'disk', documentId });
    });

    expect(releaseRecovery).toHaveBeenCalledWith(documentId);
    expect(handleDecision).not.toHaveBeenCalled();
    expect(result.current.activeConflict).toBeNull();
  });

  it('leaves the other recoveries in place when the disk copy cannot be released', async () => {
    window.mdxpad = {
      ...previousMdxpad,
      recoveryPreview: async () => ({ ok: true as const, content: 'recovered text', conflict }),
    } as unknown as typeof window.mdxpad;
    const releaseRecovery = vi.fn(async () => false);
    const handleDecision = vi.fn();
    const handleNotification = vi.fn();
    const state = {
      documentContent: '',
      handleNotification,
      recovery: {
        entries: [
          { documentId, hasConflict: true },
          { documentId: otherId, hasConflict: false },
        ],
        handleDecision,
        releaseRecovery,
      },
    } as unknown as AppState;

    const result = await openConflict(state);
    await act(async () => {
      await result.current.handleConflictResolve({ choice: 'disk', documentId });
    });

    expect(handleDecision).not.toHaveBeenCalled();
    expect(handleNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not discard the recovery copy',
    });
    expect(result.current.activeConflict?.documentId).toBe(documentId);
  });
});
