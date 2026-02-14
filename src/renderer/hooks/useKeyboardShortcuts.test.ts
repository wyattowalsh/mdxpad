/**
 * Tests for useKeyboardShortcuts hook.
 * Validates editable-field shortcut allowances for registered global actions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useCommandRegistry } from '../stores/command-registry-store';
import type { CommandId } from '@shared/types/commands';

function registerShortcutCommand(id: string, key: string, withShift = false): void {
  useCommandRegistry.getState().register({
    id: id as CommandId,
    name: id,
    category: 'view',
    shortcut: { key, modifiers: withShift ? ['Mod', 'Shift'] : ['Mod'] },
    execute: () => ({ ok: true }),
  });
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    useCommandRegistry.setState({
      commands: new Map(),
      shortcutIndex: new Map(),
      recentCommands: [],
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('allows Mod+Shift+P in contentEditable for command palette toggle', () => {
    registerShortcutCommand('view.command-palette', 'p', true);
    const onShortcutExecuted = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onShortcutExecuted }));

    const editable = document.createElement('textarea');
    document.body.appendChild(editable);
    editable.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    editable.dispatchEvent(event);

    expect(onShortcutExecuted).toHaveBeenCalledTimes(1);
    expect(onShortcutExecuted).toHaveBeenCalledWith(
      'Mod+Shift+p',
      'view.command-palette'
    );
  });

  it('still allows Mod+P in contentEditable for filter focus shortcut', () => {
    registerShortcutCommand('view.filter-focus', 'p', false);
    const onShortcutExecuted = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onShortcutExecuted }));

    const editable = document.createElement('textarea');
    document.body.appendChild(editable);
    editable.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    editable.dispatchEvent(event);

    expect(onShortcutExecuted).toHaveBeenCalledTimes(1);
    expect(onShortcutExecuted).toHaveBeenCalledWith(
      'Mod+p',
      'view.filter-focus'
    );
  });

  it('allows other registered Mod shortcuts in contentEditable', () => {
    registerShortcutCommand('file.open', 'o', false);
    const onShortcutExecuted = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onShortcutExecuted }));

    const editable = document.createElement('textarea');
    document.body.appendChild(editable);
    editable.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    editable.dispatchEvent(event);

    expect(onShortcutExecuted).toHaveBeenCalledTimes(1);
    expect(onShortcutExecuted).toHaveBeenCalledWith(
      'Mod+o',
      'file.open'
    );
  });

  it('blocks unregistered shortcuts in contentEditable', () => {
    const onShortcutExecuted = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onShortcutExecuted }));

    const editable = document.createElement('textarea');
    document.body.appendChild(editable);
    editable.focus();

    const event = new KeyboardEvent('keydown', {
      key: '=',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    editable.dispatchEvent(event);

    expect(onShortcutExecuted).not.toHaveBeenCalled();
  });
});
