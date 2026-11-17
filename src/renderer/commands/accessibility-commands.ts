import type { Command, CommandId, CommandResult } from '@shared/types/commands';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useAccessibilityStore } from '@renderer/stores/accessibility-store';

import { requestVoiceToggle } from '@renderer/lib/voice-toggle';

const accessibilityCommands: readonly Command[] = [
  {
    id: 'view.toggle-high-contrast' as CommandId,
    name: 'Toggle High Contrast',
    category: 'view',
    execute: (): CommandResult => {
      useAccessibilityStore.getState().toggleHighContrast();
      return { ok: true };
    },
  },
  {
    id: 'view.toggle-reduced-motion' as CommandId,
    name: 'Toggle Reduced Motion',
    category: 'view',
    execute: (): CommandResult => {
      useAccessibilityStore.getState().toggleReducedMotion();
      return { ok: true };
    },
  },
  {
    id: 'view.toggle-large-text' as CommandId,
    name: 'Toggle Large Text',
    category: 'view',
    execute: (): CommandResult => {
      useAccessibilityStore.getState().toggleLargeText();
      return { ok: true };
    },
  },
  {
    id: 'edit.toggle-voice-input' as CommandId,
    name: 'Toggle Voice Input',
    category: 'edit',
    execute: (): CommandResult => {
      requestVoiceToggle();
      return { ok: true };
    },
  },
];

export function registerAccessibilityCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];
  for (const command of accessibilityCommands) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    }
  }
  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}
