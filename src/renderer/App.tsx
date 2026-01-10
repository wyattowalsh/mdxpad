/**
 * Root application component.
 * Shows basic shell UI with app info.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@ui/button';
import { CommandPalette } from './components/CommandPalette';
import { useCommandPalette, buildCommandContext } from './hooks/useCommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCommandRegistry } from './stores/command-registry-store';
import { registerAllCommands } from './commands';
import type { CommandContext, CommandId, NormalizedShortcut } from '@shared/types/commands';

/** Get mdxpad API with fallback for non-Electron environments */
function getMdxpadApi() {
  return window.mdxpad ?? {
    getVersion: async () => 'dev',
    getSecurityInfo: async () => ({ contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true }),
    openFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    saveFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    saveFileAs: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    readFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    writeFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    closeWindow: async () => {},
    minimizeWindow: async () => {},
    maximizeWindow: async () => {},
    signalReady: async () => {},
    onFileChange: () => () => {},
    onMenuCommandPalette: () => () => {},
    onMenuNewFile: () => () => {},
    onMenuOpenFileDialog: () => () => {},
    onMenuOpenFile: () => () => {},
    onMenuSaveFile: () => () => {},
    onMenuSaveFileAs: () => () => {},
    platform: { os: 'browser' as const, arch: 'unknown' as const },
  };
}

/** Hook for registering built-in commands */
function useBuiltInCommands(toggle: () => void): void {
  useEffect(() => {
    const { register } = useCommandRegistry.getState();
    register({
      id: 'command-palette.toggle' as CommandId,
      name: 'Toggle Command Palette',
      category: 'view',
      shortcut: { key: 'p', modifiers: ['Mod', 'Shift'] },
      execute: () => { toggle(); return { ok: true }; },
    });
    const unregister = registerAllCommands();
    return () => { unregister(); };
  }, [toggle]);
}

/** Hook for app version and menu events */
function useAppEvents(toggle: () => void): { version: string; platform: { os: string; arch: string } } {
  const mdxpad = getMdxpadApi();
  const [version, setVersion] = useState<string>('...');
  useEffect(() => {
    void mdxpad.getVersion().then(setVersion);
    const unsub = mdxpad.onMenuCommandPalette(() => { toggle(); });
    return () => { unsub(); };
  }, [toggle, mdxpad]);
  return { version, platform: mdxpad.platform };
}

/** Main App component. */
export function App(): React.ReactElement {
  const palette = useCommandPalette();
  const { isOpen, toggle, executeCommand } = palette;
  const { version, platform } = useAppEvents(toggle);
  useBuiltInCommands(toggle);

  const getCommandContext = useCallback((): CommandContext => buildCommandContext(
    null, getMdxpadApi(),
    { fileId: null, filePath: null, content: '', isDirty: false },
    (n) => { console.log(`[${n.type}] ${n.message}`); }
  ), []);

  const handleShortcut = useCallback(
    (_: NormalizedShortcut, cmdId: string) => {
      void executeCommand(cmdId as CommandId, getCommandContext());
    },
    [executeCommand, getCommandContext]
  );

  useKeyboardShortcuts({ enabled: !isOpen, onShortcutExecuted: handleShortcut });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="h-8 w-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold">mdxpad</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Version {version} • {platform.os} {platform.arch}
          </p>
          <Button className="mt-4" variant="default" onClick={toggle}>Get Started</Button>
        </div>
      </main>
      <CommandPalette getContext={getCommandContext} palette={palette} />
    </div>
  );
}
