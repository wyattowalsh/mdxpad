/**
 * Open autosave files the main process recovered before the window existed.
 */

import { useEffect } from 'react';

import { openRecoveredDocuments } from '@renderer/components/tabs/restore-document-tabs';

export function useStartupRecovery(): void {
  useEffect(() => {
    return window.mdxpad.onRecoveryRestore((entries) => {
      openRecoveredDocuments(
        entries.map((entry) => ({
          documentId: crypto.randomUUID(),
          filePath: null,
          fileName: entry.displayName,
          content: entry.content,
        }))
      );
    });
  }, []);
}
