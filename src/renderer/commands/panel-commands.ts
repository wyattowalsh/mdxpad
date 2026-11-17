import type { Command, CommandId } from '@shared/types/commands';
import { isFeatureEnabled } from '@renderer/stores/feature-flags-store';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useUtilityPanelStore, type UtilityPanelId } from '@renderer/stores/utility-panel-store';

export const PANEL_COMMAND_IDS = {
  workspace: 'view.toggle-workspace',
  export: 'view.toggle-export',
  comments: 'view.toggle-comments',
  share: 'view.toggle-share',
  history: 'view.toggle-history',
  tags: 'view.toggle-tags',
  shortcuts: 'view.toggle-shortcuts',
  publish: 'view.toggle-publish',
  semanticSearch: 'view.toggle-semantic-search',
} as const;

function toggleCommand(
  id: string,
  name: string,
  panel: UtilityPanelId,
  enabled?: () => boolean
): Command {
  return {
    id: id as CommandId,
    name,
    category: 'view',
    ...(enabled ? { enabled: () => enabled() } : {}),
    execute: () => {
      useUtilityPanelStore.getState().toggleUtilityPanel(panel);
      return { ok: true };
    },
  };
}

export const PANEL_COMMANDS: readonly Command[] = [
  toggleCommand('view.toggle-workspace', 'Toggle Workspace', 'workspace', () =>
    isFeatureEnabled('workspace')
  ),
  toggleCommand('view.toggle-export', 'Toggle Export', 'export', () => isFeatureEnabled('export')),
  toggleCommand('view.toggle-comments', 'Toggle Comments', 'comments'),
  toggleCommand('view.toggle-share', 'Toggle Share Links', 'share'),
  toggleCommand('view.toggle-history', 'Toggle Version History', 'history'),
  toggleCommand('view.toggle-tags', 'Toggle Tags', 'tags'),
  toggleCommand('view.toggle-shortcuts', 'Toggle Keyboard Shortcuts', 'shortcuts'),
  toggleCommand('view.toggle-publish', 'Toggle Publish', 'publish'),
  toggleCommand('view.toggle-semantic-search', 'Toggle Semantic Search', 'semantic-search'),
];

export function registerPanelCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];
  for (const command of PANEL_COMMANDS) {
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
