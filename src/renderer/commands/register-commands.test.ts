import { afterEach, describe, expect, it } from 'vitest';

import type { CommandId, NormalizedShortcut } from '@shared/types/commands';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useKeybindingStore } from '@renderer/stores/keybinding-store';

import { registerAllCommands } from './index';

describe('registerAllCommands', () => {
  let unregister: (() => void) | undefined;

  afterEach(() => {
    unregister?.();
    unregister = undefined;
    useKeybindingStore.setState({ bindings: [], defaults: [] });
  });

  it('applies a saved shortcut when commands are registered', () => {
    useKeybindingStore.setState({
      bindings: [
        { commandId: 'file.save', key: 'x', modifiers: ['Mod'], label: 'Save', category: 'file' },
      ],
      defaults: [],
    });

    unregister = registerAllCommands();

    expect(useCommandRegistry.getState().getCommand('file.save' as CommandId)?.shortcut).toEqual({
      key: 'x',
      modifiers: ['Mod'],
    });
    expect(
      useCommandRegistry.getState().getCommandByShortcut('Mod+x' as NormalizedShortcut)?.id
    ).toBe('file.save');
    expect(useKeybindingStore.getState().defaults.length).toBeGreaterThan(0);
  });
});
