/**
 * Application State Hook
 *
 * Centralizes all state declarations, store subscriptions, and state-derived
 * handlers that were previously inline in App.tsx. This keeps the root component
 * focused on layout and composition.
 *
 * @module renderer/hooks/useAppState
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStatusMessageStore } from '../stores/status-message-store';
import type { EditorView } from '@codemirror/view';
import {
  useUILayoutStore,
  selectPreviewVisible,
  selectSplitRatio,
  selectOutlineVisible,
  selectFrontmatterVisible,
} from '../stores/ui-layout-store';
import {
  useDocumentStore,
  selectFileId,
  selectFileName,
  selectFilePath,
  selectIsDirty,
  selectContent,
} from '../stores/document-store';
import {
  useTemplateBrowserModalStore,
  selectIsTemplateBrowserOpen,
  selectIsVariableDialogOpen,
  selectPendingTemplate,
  selectIsSaveTemplateDialogOpen,
  selectIsSaving,
  selectSaveError,
} from '../stores/template-browser-store';
import { useTemplateStore, selectTemplates } from '../stores/template-store';
import { useSettingsStore } from '../stores/settings-store';
import { useAutosave } from './use-autosave';
import { useRecoveryCheck } from './use-recovery-check';
import { useRecoveryRestore } from './use-recovery-restore';
import { useRecoveryCleanup } from './use-recovery-cleanup';
import { useOutlineSync } from './useOutlineSync';
import { useOutlineNavigation } from './useOutlineNavigation';
import { useErrorNavigation } from './useErrorNavigation';
import { useScrollSync } from './useScrollSync';
import { substituteVariables, buildVariableValues } from '../lib/template-variables';
import type { CursorPosition } from '../components/shell/EditorPane';
import type { CompilationError } from '../components/shell/StatusBar/types';
import type { OutlineItem } from '@shared/types/outline';
import type { NotificationInput } from '@shared/types/commands';
import type { Template } from '@shared/contracts/template-schemas';
import type { DocumentId } from '@shared/types/document';
import type { SaveTemplateFormData } from '../components/template-browser/SaveTemplateDialog';

/** Convert split ratio (0-1) to panel size percentage */
function ratioToSize(ratio: number): number {
  return ratio * 100;
}

/** Convert panel sizes array to split ratio */
function sizesToRatio(sizes: number[]): number {
  return (sizes[0] ?? 50) / 100;
}

export interface AppState {
  // Refs
  readonly editorRef: React.RefObject<EditorView | null>;
  readonly previewIframeRef: React.RefObject<HTMLIFrameElement | null>;

  // UI layout
  readonly previewVisible: boolean;
  readonly outlineVisible: boolean;
  readonly frontmatterVisible: boolean;
  readonly editorSize: number;
  readonly previewSize: number;

  // Document state
  readonly fileId: string | null;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly isDirty: boolean;
  readonly fileMissing: boolean;
  readonly documentContent: string;

  // Local state
  readonly cursorPosition: CursorPosition;
  readonly errors: readonly CompilationError[];
  readonly announcement: string;

  // Settings
  readonly settingsOpen: boolean;
  readonly closeSettings: () => void;

  // Autosave
  readonly autosave: ReturnType<typeof useAutosave>;

  // Recovery
  readonly recovery: ReturnType<typeof useRecoveryCheck>;

  // Template browser modal
  readonly isTemplateBrowserOpen: boolean;
  readonly isVariableDialogOpen: boolean;
  readonly pendingTemplate: Template | null;
  readonly closeTemplateBrowser: () => void;

  // Save template dialog
  readonly isSaveTemplateDialogOpen: boolean;
  readonly isSaving: boolean;
  readonly saveError: string | null;
  readonly closeSaveTemplateDialog: () => void;
  readonly existingTemplateNames: string[];

  // Handlers
  readonly handleLayout: (sizes: number[]) => void;
  readonly handleCursorChange: (position: CursorPosition) => void;
  readonly handleErrorsChange: (newErrors: readonly CompilationError[]) => void;
  readonly handleErrorClick: (error: CompilationError) => void;
  readonly handlePreviewErrorClick: (line: number, column?: number) => void;
  readonly handleOutlineNavigate: (item: OutlineItem) => void;
  readonly handleBreadcrumbNavigate: (segment: {
    label: string;
    line?: number | undefined;
    column?: number | undefined;
    level?: OutlineItem['level'] | undefined;
    outlineId?: string | undefined;
  }) => void;
  readonly handleTemplateSelect: (template: Template) => void;
  readonly handleVariableSubmit: (values: Record<string, string>) => void;
  readonly handleVariableCancel: () => void;
  readonly handleSaveTemplate: (data: SaveTemplateFormData) => Promise<void>;
  readonly handleNotification: (n: NotificationInput) => void;
}

/** Consolidated application state hook. */
// eslint-disable-next-line max-lines-per-function
export function useAppState(): AppState {
  // Refs
  const editorRef = useRef<EditorView | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Store subscriptions - UI layout
  const previewVisible = useUILayoutStore(selectPreviewVisible);
  const outlineVisible = useUILayoutStore(selectOutlineVisible);
  const frontmatterVisible = useUILayoutStore(selectFrontmatterVisible);
  const splitRatio = useUILayoutStore(selectSplitRatio);
  // Actions are stable references — use getState() to avoid inline lambda churn
  const setSplitRatio = useUILayoutStore.getState().setSplitRatio;

  // Store subscriptions - Document
  const fileId = useDocumentStore(selectFileId);
  const filePath = useDocumentStore(selectFilePath);
  const fileName = useDocumentStore(selectFileName);
  const isDirty = useDocumentStore(selectIsDirty);
  const fileMissing = useDocumentStore((store) => store.fileMissing);
  const documentContent = useDocumentStore(selectContent);
  const setContent = useDocumentStore.getState().setContent;
  const newDocument = useDocumentStore.getState().newDocument;
  const openDocument = useDocumentStore.getState().openDocument;

  // Store subscriptions - Template browser modal
  const isTemplateBrowserOpen = useTemplateBrowserModalStore(selectIsTemplateBrowserOpen);
  const isVariableDialogOpen = useTemplateBrowserModalStore(selectIsVariableDialogOpen);
  const pendingTemplate = useTemplateBrowserModalStore(selectPendingTemplate);
  const openTemplateBrowser = useTemplateBrowserModalStore.getState().openTemplateBrowser;
  const closeTemplateBrowser = useTemplateBrowserModalStore.getState().closeTemplateBrowser;
  const startVariableDialog = useTemplateBrowserModalStore.getState().startVariableDialog;
  const closeVariableDialog = useTemplateBrowserModalStore.getState().closeVariableDialog;
  const clearPendingTemplate = useTemplateBrowserModalStore.getState().clearPendingTemplate;

  // Save template dialog state
  const isSaveTemplateDialogOpen = useTemplateBrowserModalStore(selectIsSaveTemplateDialogOpen);
  const isSaving = useTemplateBrowserModalStore(selectIsSaving);
  const saveError = useTemplateBrowserModalStore(selectSaveError);
  const closeSaveTemplateDialog = useTemplateBrowserModalStore.getState().closeSaveTemplateDialog;
  const setSaving = useTemplateBrowserModalStore.getState().setSaving;
  const setSaveError = useTemplateBrowserModalStore.getState().setSaveError;

  // Template store for saving and getting existing names
  const templates = useTemplateStore(selectTemplates);
  const saveTemplate = useTemplateStore.getState().saveTemplate;

  // Settings
  const settingsOpen = useSettingsStore((s) => s.isOpen);
  const closeSettings = useSettingsStore.getState().close;

  // Autosave & Recovery
  const autosave = useAutosave();
  const { restoreDocuments } = useRecoveryRestore();
  const recovery = useRecoveryCheck({ onRestore: restoreDocuments });
  useRecoveryCleanup();

  // Outline sync & navigation
  useOutlineSync();
  const { navigateToItem } = useOutlineNavigation({ editorRef });

  // Error navigation (P1-1 wire-up)
  const { navigateToError } = useErrorNavigation({ editorRef });

  // Scroll sync (Feature: 008-bidirectional-sync)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { syncEditorToPreview } = useScrollSync({
    editorRef,
    previewRef: previewIframeRef,
  });

  // Local state
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  const [errors, setErrors] = useState<readonly CompilationError[]>([]);
  const [announcement, setAnnouncement] = useState<string>('');
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const maybeMdxpad = (window as unknown as { mdxpad?: typeof window.mdxpad }).mdxpad;
    if (!maybeMdxpad) return;

    const unsubscribe = maybeMdxpad.onMenuOpenFile((event) => {
      if (event.handle.path === null) return;

      openDocument(
        {
          fileId: event.handle.id as unknown as DocumentId,
          filePath: event.handle.path,
          mtime: Date.now(),
        },
        event.content
      );
    });

    return () => {
      unsubscribe();
    };
  }, [openDocument]);

  // Computed values
  const editorSize = useMemo(() => {
    if (!previewVisible) return 100;
    return ratioToSize(splitRatio);
  }, [previewVisible, splitRatio]);

  const previewSize = useMemo(() => {
    if (!previewVisible) return 0;
    return ratioToSize(1 - splitRatio);
  }, [previewVisible, splitRatio]);

  const existingTemplateNames = useMemo(
    () => templates.map((t) => t.name.toLowerCase()),
    [templates]
  );

  // Handlers - Layout & cursor
  const handleLayout = useCallback(
    (sizes: number[]): void => {
      setSplitRatio(sizesToRatio(sizes));
    },
    [setSplitRatio]
  );

  const handleCursorChange = useCallback((position: CursorPosition): void => {
    setCursorPosition(position);
  }, []);

  const handleErrorsChange = useCallback((newErrors: readonly CompilationError[]): void => {
    setErrors(newErrors);
  }, []);

  // Handlers - Error navigation (P1-1: wired to useErrorNavigation)
  const handleErrorClick = useCallback(
    (error: CompilationError): void => {
      navigateToError({ line: error.line, column: error.column });
    },
    [navigateToError]
  );

  const handlePreviewErrorClick = useCallback(
    (line: number, column?: number): void => {
      navigateToError({ line, column: column ?? 1 });
    },
    [navigateToError]
  );

  // Handlers - Outline navigation
  const handleOutlineNavigate = useCallback(
    (item: OutlineItem): void => {
      navigateToItem(item);
    },
    [navigateToItem]
  );

  const handleBreadcrumbNavigate = useCallback(
    (segment: {
      label: string;
      line?: number | undefined;
      column?: number | undefined;
      level?: OutlineItem['level'] | undefined;
      outlineId?: string | undefined;
    }): void => {
      if (segment.line === undefined) {
        return;
      }
      navigateToItem({
        id: segment.outlineId ?? segment.label,
        type: 'heading',
        label: segment.label,
        level: segment.level ?? 1,
        line: segment.line,
        column: segment.column ?? 1,
        children: [],
      });
    },
    [navigateToItem]
  );

  // Handlers - Templates
  const templateNeedsVariables = useCallback((template: Template): boolean => {
    const { variables } = template;
    if (variables.length === 0) return false;
    return variables.some((v) => v.required && (!v.default || v.default === ''));
  }, []);

  const createDocumentFromTemplate = useCallback(
    (template: Template, variableValues: Record<string, string>): void => {
      const completeValues = buildVariableValues(template.variables, variableValues);
      const substitutedContent = substituteVariables(template.content, completeValues);
      newDocument();
      setContent(substitutedContent);
      clearPendingTemplate();
    },
    [newDocument, setContent, clearPendingTemplate]
  );

  const handleTemplateSelect = useCallback(
    (template: Template): void => {
      if (templateNeedsVariables(template)) {
        startVariableDialog(template);
      } else {
        createDocumentFromTemplate(template, {});
        closeTemplateBrowser();
      }
    },
    [templateNeedsVariables, startVariableDialog, createDocumentFromTemplate, closeTemplateBrowser]
  );

  const handleVariableSubmit = useCallback(
    (values: Record<string, string>): void => {
      if (pendingTemplate) {
        createDocumentFromTemplate(pendingTemplate, values);
        closeVariableDialog();
      }
    },
    [pendingTemplate, createDocumentFromTemplate, closeVariableDialog]
  );

  const handleVariableCancel = useCallback((): void => {
    closeVariableDialog();
    clearPendingTemplate();
    openTemplateBrowser();
  }, [closeVariableDialog, clearPendingTemplate, openTemplateBrowser]);

  // Handlers - Save template
  const handleSaveTemplate = useCallback(
    async (data: SaveTemplateFormData): Promise<void> => {
      setSaving(true);
      setSaveError(null);

      try {
        await saveTemplate(
          {
            name: data.name,
            description: data.description,
            category: data.category,
            tags: data.tags,
            variables: data.variables,
            content: data.content,
          },
          false
        );
        closeSaveTemplateDialog();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
        setSaveError(errorMessage);
      }
    },
    [saveTemplate, setSaving, setSaveError, closeSaveTemplateDialog]
  );

  // Handlers - Notification (T027 screen reader)
  const handleNotification = useCallback((n: NotificationInput) => {
    setAnnouncement(n.message);
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }
    announcementTimerRef.current = setTimeout(() => {
      setAnnouncement('');
      announcementTimerRef.current = null;
    }, n.duration ?? 3000);
  }, []);

  useEffect(() => {
    return useStatusMessageStore.subscribe((state, previous) => {
      if (state.message.length > 0 && state.message !== previous.message) {
        handleNotification({ type: 'warning', message: state.message });
      }
    });
  }, [handleNotification]);

  useEffect(() => {
    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
    };
  }, []);

  return {
    editorRef,
    previewIframeRef,
    previewVisible,
    outlineVisible,
    frontmatterVisible,
    editorSize,
    previewSize,
    fileId,
    filePath,
    fileName,
    isDirty,
    fileMissing,
    documentContent,
    cursorPosition,
    errors,
    announcement,
    settingsOpen,
    closeSettings,
    autosave,
    recovery,
    isTemplateBrowserOpen,
    isVariableDialogOpen,
    pendingTemplate,
    closeTemplateBrowser,
    isSaveTemplateDialogOpen,
    isSaving,
    saveError,
    closeSaveTemplateDialog,
    existingTemplateNames,
    handleLayout,
    handleCursorChange,
    handleErrorsChange,
    handleErrorClick,
    handlePreviewErrorClick,
    handleOutlineNavigate,
    handleBreadcrumbNavigate,
    handleTemplateSelect,
    handleVariableSubmit,
    handleVariableCancel,
    handleSaveTemplate,
    handleNotification,
  };
}
