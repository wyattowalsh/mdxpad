/**
 * Global keyboard shortcuts hook.
 * Listens for keyboard shortcuts and dispatches commands.
 *
 * @module renderer/hooks/useKeyboardShortcuts
 */

import { useEffect, useCallback, useRef } from 'react';
import type { NormalizedShortcut, ModifierKey } from '@shared/types/commands';
import { useCommandRegistry } from '../stores/command-registry-store';

/** Debounce interval for rapid key presses (ms) */
const DEBOUNCE_MS = 200;

/**
 * Check if a keyboard event matches a normalized shortcut.
 */
function eventMatchesShortcut(event: KeyboardEvent, shortcut: NormalizedShortcut): boolean {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1]?.toLowerCase();
  const modifiers = new Set(parts.slice(0, -1));

  // Check key match
  if (event.key.toLowerCase() !== key) return false;

  // Check Mod (Cmd on macOS, Ctrl on Windows/Linux)
  const isMac = navigator.platform.includes('Mac');
  const modKey = isMac ? event.metaKey : event.ctrlKey;

  if (modifiers.has('Mod') && !modKey) return false;
  if (!modifiers.has('Mod') && modKey) return false;

  // Check explicit modifiers
  if (modifiers.has('Ctrl') !== event.ctrlKey && !modifiers.has('Mod')) return false;
  if (modifiers.has('Shift') !== event.shiftKey) return false;
  if (modifiers.has('Alt') !== event.altKey) return false;
  if (modifiers.has('Meta') !== event.metaKey && !modifiers.has('Mod')) return false;

  return true;
}

/**
 * Normalize keyboard event modifiers to an array.
 */
function getModifiersFromEvent(event: KeyboardEvent): ModifierKey[] {
  const modifiers: ModifierKey[] = [];
  const isMac = navigator.platform.includes('Mac');

  if (isMac && event.metaKey) modifiers.push('Mod');
  if (!isMac && event.ctrlKey) modifiers.push('Mod');
  if (event.ctrlKey && !(!isMac && modifiers.includes('Mod'))) modifiers.push('Ctrl');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.altKey) modifiers.push('Alt');
  if (event.metaKey && !(isMac && modifiers.includes('Mod'))) modifiers.push('Meta');

  return modifiers;
}

/**
 * Create a normalized shortcut string from keyboard event.
 */
function normalizeEventToShortcut(event: KeyboardEvent): NormalizedShortcut {
  const modifiers = getModifiersFromEvent(event);
  const sortedModifiers = [...modifiers].sort();
  const parts = [...sortedModifiers, event.key.toLowerCase()];
  return parts.join('+') as NormalizedShortcut;
}

export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
  /** Callback when a shortcut is executed */
  onShortcutExecuted?: (shortcut: NormalizedShortcut, commandId: string) => void;
  /** Callback when execution fails */
  onShortcutFailed?: (shortcut: NormalizedShortcut, error: string) => void;
}

/**
 * Hook that listens for global keyboard shortcuts and dispatches commands.
 * Automatically looks up shortcuts in the command registry.
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function App() {
 *   useKeyboardShortcuts({
 *     enabled: !isModalOpen,
 *     onShortcutExecuted: (shortcut, cmd) => console.log(`Executed ${cmd}`),
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}): void {
  const { enabled = true, onShortcutExecuted, onShortcutFailed } = options;

  const lastExecutionRef = useRef<number>(0);
  const getCommandByShortcut = useCommandRegistry((state) => state.getCommandByShortcut);
  const getCommand = useCommandRegistry((state) => state.getCommand);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in input/textarea (unless it's allowed)
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape key
        if (event.key === 'Escape') {
          // Allow through
        }
        // Allow Mod+P for filter focus (per FR-012)
        else if (
          event.key.toLowerCase() === 'p' &&
          (navigator.platform.includes('Mac') ? event.metaKey : event.ctrlKey) &&
          !event.shiftKey &&
          !event.altKey
        ) {
          // Allow through
        } else {
          return;
        }
      }

      // Build normalized shortcut from event
      const normalized = normalizeEventToShortcut(event);

      // Look up command in registry
      const command = getCommandByShortcut(normalized);
      if (!command) return;

      // Debounce rapid key presses
      const now = Date.now();
      if (now - lastExecutionRef.current < DEBOUNCE_MS) return;
      lastExecutionRef.current = now;

      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();

      // Execute command (async)
      // Note: Actual execution will be handled by useCommandPalette or command executor
      onShortcutExecuted?.(normalized, command.id);
    },
    [enabled, getCommandByShortcut, onShortcutExecuted]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, handleKeyDown]);
}

/**
 * Check if the current platform is macOS.
 */
export function isMacOS(): boolean {
  return navigator.platform.includes('Mac');
}

/**
 * Format a shortcut for display (e.g., "Mod+S" -> "⌘S" on macOS).
 */
export function formatShortcut(shortcut: NormalizedShortcut): string {
  const isMac = isMacOS();
  const parts = shortcut.split('+');

  const formatted = parts.map((part) => {
    switch (part) {
      case 'Mod':
        return isMac ? '⌘' : 'Ctrl';
      case 'Ctrl':
        return isMac ? '⌃' : 'Ctrl';
      case 'Shift':
        return isMac ? '⇧' : 'Shift';
      case 'Alt':
        return isMac ? '⌥' : 'Alt';
      case 'Meta':
        return isMac ? '⌘' : 'Win';
      default:
        // Capitalize single-letter keys
        return part.length === 1 ? part.toUpperCase() : part;
    }
  });

  return isMac ? formatted.join('') : formatted.join('+');
}
