/**
 * App Dialogs Hook
 *
 * Extracts dialog state management (recovery, conflict, frontmatter sync)
 * from App.tsx to reduce its line count below 400.
 *
 * @module renderer/hooks/useAppDialogs
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { useFrontmatterStore } from '../stores/frontmatter-store';
import { selectActiveTabId, useTabStore } from '../stores/tab-store';
import { replaceFrontmatter } from '../lib/frontmatter';
import type {
  RecoveryDecision,
  ConflictResolution,
  FileConflict,
} from '@shared/contracts/autosave-schemas';
import type { AppState } from './useAppState';

const FRONTMATTER_SYNC_DELAY_MS = 150;

function useFrontmatterDocumentSync(content: string): void {
  const filePath = useDocumentStore((state) => state.filePath);
  const activeTabId = useTabStore(selectActiveTabId);
  const documentKey = filePath ?? `untitled:${activeTabId ?? 'new'}`;
  const previousKey = useRef(documentKey);
  const isMountedRef = useRef(true);
  const syncTokenRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const keyChanged = previousKey.current !== documentKey;
    previousKey.current = documentKey;
    syncTokenRef.current += 1;
    const syncToken = syncTokenRef.current;
    const apply = (): void => {
      if (!isMountedRef.current || syncTokenRef.current !== syncToken) {
        return;
      }
      const frontmatterStore = useFrontmatterStore.getState();
      if (!keyChanged && frontmatterStore.lastChangeSource === 'panel') {
        return;
      }
      frontmatterStore.parseFromDocument(content);
    };
    if (keyChanged) {
      apply();
      return;
    }
    const timeoutId = window.setTimeout(apply, FRONTMATTER_SYNC_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [content, documentKey]);
}

async function saveRecoveryCopy(conflict: FileConflict | null, state: AppState): Promise<boolean> {
  if (!conflict) {
    state.handleNotification({
      type: 'error',
      message: 'No recovery copy is available to save',
    });
    return false;
  }

  const saved = await window.mdxpad.saveFileAs(conflict.recoveryContent, conflict.filePath);
  if (!saved.ok) {
    if (saved.error.code === 'CANCELLED') {
      return false;
    }
    const detail = saved.error.code === 'UNKNOWN' ? saved.error.message : saved.error.code;
    state.handleNotification({
      type: 'error',
      message: `Could not save the recovery copy: ${detail}`,
    });
    return false;
  }

  const released = await state.recovery.releaseRecovery(conflict.documentId);
  if (!released) {
    state.handleNotification({
      type: 'error',
      message: `Saved recovery copy to ${saved.value.name}, and that recovery entry is still available`,
    });
    return false;
  }

  state.handleNotification({
    type: 'success',
    message: `Saved recovery copy to ${saved.value.name}`,
  });
  return true;
}

export interface AppDialogsState {
  readonly activeConflict: FileConflict | null;
  readonly handleRecoveryDecision: (decision: RecoveryDecision) => Promise<void>;
  readonly handleConflictResolve: (resolution: ConflictResolution) => Promise<void>;
  readonly handleConflictCancel: () => void;
  readonly handleAddFrontmatter: () => void;
  readonly handleApplyAutoFix: (fixedContent: string) => void;
}

/**
 * Hook managing dialog state and frontmatter sync extracted from App.tsx.
 */
export function useAppDialogs(state: AppState): AppDialogsState {
  const [activeConflict, setActiveConflict] = useState<FileConflict | null>(null);
  const isMountedRef = useRef(true);
  useFrontmatterDocumentSync(state.documentContent);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Frontmatter panel -> document sync
  useEffect(() => {
    const unsubscribe = useFrontmatterStore.subscribe((frontmatterState) => {
      if (!isMountedRef.current) return;
      if (
        frontmatterState.lastChangeSource !== 'panel' ||
        !frontmatterState.isDirty ||
        frontmatterState.mode !== 'visual'
      ) {
        return;
      }

      const currentContent = useDocumentStore.getState().content;
      const nextContent = replaceFrontmatter(currentContent, frontmatterState.serializeToYaml());

      if (nextContent !== currentContent) {
        useDocumentStore.getState().setContent(nextContent);
      }

      useFrontmatterStore.getState().setChangeSource('document');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAddFrontmatter = useCallback(() => {
    useFrontmatterStore.getState().addField('title', 'text');
  }, []);

  const handleApplyAutoFix = useCallback((fixedContent: string) => {
    useDocumentStore.getState().setContent(fixedContent);
    useFrontmatterStore.getState().parseFromDocument(fixedContent);
  }, []);

  const handleRecoveryDecision = useCallback(
    async (decision: RecoveryDecision) => {
      if (decision.action !== 'accept' || decision.selectedIds.length !== 1) {
        await state.recovery.handleDecision(decision);
        return;
      }

      const selectedId = decision.selectedIds[0];
      if (selectedId === undefined) {
        await state.recovery.handleDecision(decision);
        return;
      }
      const selectedEntry = state.recovery.entries.find((entry) => entry.documentId === selectedId);

      if (!selectedEntry?.hasConflict) {
        await state.recovery.handleDecision(decision);
        return;
      }

      const preview = await window.mdxpad.recoveryPreview({ documentId: selectedId });
      if (!isMountedRef.current) return;
      if (preview.ok && preview.conflict) {
        setActiveConflict(preview.conflict);
        return;
      }

      await state.recovery.handleDecision(decision);
    },
    [state]
  );

  const handleConflictResolve = useCallback(
    async (resolution: ConflictResolution) => {
      if (resolution.choice === 'save-as') {
        const saved = await saveRecoveryCopy(activeConflict, state);
        if (saved && isMountedRef.current) {
          setActiveConflict(null);
        }
        return;
      }

      if (resolution.choice === 'recovery') {
        await state.recovery.handleDecision({
          action: 'accept',
          selectedIds: [resolution.documentId],
        });
      } else {
        await state.recovery.handleDecision({ action: 'decline' });
      }

      if (isMountedRef.current) {
        setActiveConflict(null);
      }
    },
    [activeConflict, state]
  );

  const handleConflictCancel = useCallback(() => {
    if (isMountedRef.current) {
      setActiveConflict(null);
    }
  }, []);

  return {
    activeConflict,
    handleRecoveryDecision,
    handleConflictResolve,
    handleConflictCancel,
    handleAddFrontmatter,
    handleApplyAutoFix,
  };
}
