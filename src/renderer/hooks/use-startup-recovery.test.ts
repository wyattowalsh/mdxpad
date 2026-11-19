import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openRecoveredDocuments = vi.fn();

vi.mock('@renderer/components/tabs/restore-document-tabs', () => ({
  openRecoveredDocuments: (...args: unknown[]) => openRecoveredDocuments(...args),
}));

import { useStartupRecovery } from './use-startup-recovery';

describe('useStartupRecovery', () => {
  beforeEach(() => {
    openRecoveredDocuments.mockReset();
    delete (window as { mdxpad?: unknown }).mdxpad;
  });

  it('opens each recovered autosave as a document', () => {
    let deliver: ((entries: unknown) => void) | undefined;
    (
      window as { mdxpad?: { onRecoveryRestore: (cb: (entries: unknown) => void) => () => void } }
    ).mdxpad = {
      onRecoveryRestore: (callback) => {
        deliver = callback;
        return () => undefined;
      },
    };

    renderHook(() => useStartupRecovery());
    deliver?.([{ displayName: 'Recovered: note', content: '# Hi', savedAt: 10 }]);

    expect(openRecoveredDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        filePath: null,
        fileName: 'Recovered: note',
        content: '# Hi',
      }),
    ]);
  });
});
