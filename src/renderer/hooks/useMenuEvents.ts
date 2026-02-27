/**
 * Menu Events Hook
 *
 * Manages native menu event subscriptions (onMenuNewFile, onMenuOpenFile, etc.),
 * command palette toggle binding, built-in command registration, keyboard
 * shortcuts, and external file-change event handling.
 *
 * Extracted from App.tsx to keep the root component focused on layout.
 *
 * @module renderer/hooks/useMenuEvents
 */

import { useEffect, useCallback, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { useCommandPalette, buildCommandContext } from './useCommandPalette';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useCommandRegistry } from '../stores/command-registry-store';
import { useDocumentStore } from '../stores/document-store';
import { registerAllCommands } from '../commands';
import { FILE_COMMAND_IDS } from '../commands/file-commands';
import type {
  CommandContext,
  CommandId,
  NormalizedShortcut,
  NotificationInput,
} from '@shared/types/commands';

// =============================================================================
// HELPERS
// =============================================================================

/** Get mdxpad API with fallback for non-Electron environments */
function getMdxpadApi() {
  const mdxpadApi = Reflect.get(window as object, 'mdxpad') as unknown;
  if (mdxpadApi !== undefined) {
    return mdxpadApi as typeof window.mdxpad;
  }

  return {
    getVersion: () => Promise.resolve('dev'),
    getSecurityInfo: () =>
      Promise.resolve({
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      }),
    openFile: () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Not in Electron' },
      }),
    saveFile: () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Not in Electron' },
      }),
    saveFileAs: () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Not in Electron' },
      }),
    exportFile: () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Not in Electron' },
        support: [],
      }),
    readFile: () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Not in Electron' },
      }),
    writeFile: () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNKNOWN' as const, message: 'Not in Electron' },
      }),
    closeWindow: () => Promise.resolve(),
    minimizeWindow: () => Promise.resolve(),
    maximizeWindow: () => Promise.resolve(),
    signalReady: () => Promise.resolve(),
    onFileChange: () => () => {
      /* noop */
    },
    onMenuCommandPalette: () => () => {
      /* noop */
    },
    onMenuNewFile: () => () => {
      /* noop */
    },
    onMenuOpenFileDialog: () => () => {
      /* noop */
    },
    onMenuOpenFile: () => () => {
      /* noop */
    },
    onMenuSaveFile: () => () => {
      /* noop */
    },
    onMenuSaveFileAs: () => () => {
      /* noop */
    },
    onMenuExportFile: () => () => {
      /* noop */
    },
    onEditorDirtyCheck: () => () => {
      /* noop */
    },
    platform: { os: 'browser' as const, arch: 'unknown' as const },
  };
}

// =============================================================================
// RETURN TYPE
// =============================================================================

export interface MenuEventsResult {
  /** The command palette state and actions */
  readonly palette: ReturnType<typeof useCommandPalette>;
  /** Application version string */
  readonly version: string;
  /** Platform info */
  readonly platform: { os: string; arch: string };
  /** Build a CommandContext for the current application state */
  readonly getCommandContext: () => CommandContext;
}

// =============================================================================
// INTERNAL HOOKS
// =============================================================================

/** Register the built-in command palette command and all feature commands */
function useBuiltInCommands(toggle: () => void): void {
  useEffect(() => {
    const { register } = useCommandRegistry.getState();
    register({
      id: 'view.command-palette' as CommandId,
      name: 'Toggle Command Palette',
      category: 'view',
      shortcut: { key: 'p', modifiers: ['Mod', 'Shift'] },
      execute: () => {
        toggle();
        return { ok: true };
      },
    });
    const unregister = registerAllCommands();
    return () => {
      unregister();
    };
  }, [toggle]);
}

/** Fetch app version and subscribe to the menu command-palette event */
function useAppVersionAndPaletteMenu(toggle: () => void): {
  version: string;
  platform: { os: string; arch: string };
} {
  const mdxpad = getMdxpadApi();
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    void mdxpad.getVersion().then(setVersion);
    const unsub = mdxpad.onMenuCommandPalette(() => {
      toggle();
    });
    return () => {
      unsub();
    };
  }, [toggle, mdxpad]);

  return { version, platform: mdxpad.platform };
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Consolidated hook for all menu / event wiring in the application.
 *
 * Handles:
 * - Command palette state
 * - Built-in command registration
 * - Keyboard shortcut dispatching
 * - Native menu accelerator bridging (Cmd/Ctrl+N/O/S/Shift+S)
 * - External file change events
 *
 * @param editorRef  Ref to the CodeMirror EditorView
 * @param handleNotification  Callback for screen-reader announcements
 */
export function useMenuEvents(
  editorRef: React.RefObject<EditorView | null>,
  handleNotification: (n: NotificationInput) => void
): MenuEventsResult {
  // Command palette state
  const palette = useCommandPalette();
  const { isOpen, toggle, executeCommand } = palette;

  // Register built-in commands and subscribe to version / palette menu event
  useBuiltInCommands(toggle);
  const { version, platform } = useAppVersionAndPaletteMenu(toggle);

  // Document state needed for building CommandContext
  const fileId = useDocumentStore((s) => s.fileId);
  const filePath = useDocumentStore((s) => s.filePath);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const documentContent = useDocumentStore((s) => s.content);
  const handleExternalChange = useDocumentStore((s) => s.handleExternalChange);

  // Build command context
  const getCommandContext = useCallback(
    (): CommandContext =>
      buildCommandContext(
        editorRef.current,
        getMdxpadApi() as typeof window.mdxpad,
        { fileId, filePath, content: documentContent, isDirty },
        handleNotification
      ),
    [editorRef, fileId, filePath, documentContent, isDirty, handleNotification]
  );

  // Keyboard shortcuts
  const handleShortcut = useCallback(
    (_: NormalizedShortcut, cmdId: string) => {
      if (cmdId === 'view.command-palette') {
        toggle();
        return;
      }
      void executeCommand(cmdId as CommandId, getCommandContext());
    },
    [executeCommand, getCommandContext, toggle]
  );

  useKeyboardShortcuts({ enabled: !isOpen, onShortcutExecuted: handleShortcut });

  // -------------------------------------------------------------------------
  // Native menu accelerator bridging
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubscribers: (() => void)[] = [];
    let pollId: number | undefined;

    const bindMenuHandlers = (): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!window.mdxpad) return false;

      const runCommandFromMenu = (commandId: CommandId): void => {
        void executeCommand(commandId, getCommandContext());
      };

      unsubscribers = [
        window.mdxpad.onMenuNewFile(() => runCommandFromMenu(FILE_COMMAND_IDS.new)),
        window.mdxpad.onMenuOpenFileDialog(() => runCommandFromMenu(FILE_COMMAND_IDS.open)),
        window.mdxpad.onMenuSaveFile(() => runCommandFromMenu(FILE_COMMAND_IDS.save)),
        window.mdxpad.onMenuSaveFileAs(() => runCommandFromMenu(FILE_COMMAND_IDS.saveAs)),
        window.mdxpad.onMenuExportFile(() => runCommandFromMenu(FILE_COMMAND_IDS.export)),
      ];
      return true;
    };

    if (!bindMenuHandlers()) {
      pollId = window.setInterval(() => {
        if (bindMenuHandlers() && pollId !== undefined) {
          window.clearInterval(pollId);
          pollId = undefined;
        }
      }, 50);
    }

    return () => {
      if (pollId !== undefined) {
        window.clearInterval(pollId);
      }
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [executeCommand, getCommandContext]);

  // -------------------------------------------------------------------------
  // Dirty-state query responder (for main-process close flow)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const mdxpad = getMdxpadApi();
    const unsubscribe = mdxpad.onEditorDirtyCheck?.(() => useDocumentStore.getState().isDirty);

    return () => {
      unsubscribe?.();
    };
  }, []);

  // -------------------------------------------------------------------------
  // External file change events
  // -------------------------------------------------------------------------
  useEffect(() => {
    const mdxpad = getMdxpadApi();

    const unsubscribe = mdxpad.onFileChange((event) => {
      if (!fileId || event.fileId !== fileId || event.type !== 'change') return;

      void (async () => {
        const result = await mdxpad.readFile(event.path);
        if (result.ok) {
          handleExternalChange(result.value, Date.now());
        }
      })();
    });

    return () => {
      unsubscribe();
    };
  }, [fileId, handleExternalChange]);

  return { palette, version, platform, getCommandContext };
}
