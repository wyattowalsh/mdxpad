import type { Command, CommandId } from '@shared/types/commands';
import { isFeatureEnabled } from '@renderer/stores/feature-flags-store';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useUtilityPanelStore, type UtilityPanelId } from '@renderer/stores/utility-panel-store';
import { useEditorModeStore } from '@renderer/stores/editor-mode-store';
import { useAIProviderStore } from '@renderer/features/ai-provider/store';

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
  agent: 'view.toggle-agent',
  diagram: 'view.toggle-diagram',
  edits: 'view.toggle-edits',
  playground: 'view.toggle-playground',
  marketplace: 'view.toggle-marketplace',
  css: 'view.toggle-css',
  themes: 'view.toggle-themes',
  plugins: 'view.toggle-plugins',
  usage: 'view.open-usage',
  wysiwyg: 'view.toggle-wysiwyg',
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
  toggleCommand('view.toggle-agent', 'Toggle AI Agent', 'agent', () => isFeatureEnabled('ai')),
  toggleCommand('view.toggle-diagram', 'Toggle Diagram Generator', 'diagram', () =>
    isFeatureEnabled('ai')
  ),
  toggleCommand('view.toggle-edits', 'Toggle AI Revisions', 'edits', () => isFeatureEnabled('ai')),
  toggleCommand('view.toggle-playground', 'Toggle Component Playground', 'playground'),
  toggleCommand('view.toggle-marketplace', 'Toggle Template Marketplace', 'marketplace'),
  toggleCommand('view.toggle-css', 'Toggle Custom CSS', 'css', () => isFeatureEnabled('plugin')),
  toggleCommand('view.toggle-themes', 'Toggle Themes', 'themes', () => isFeatureEnabled('plugin')),
  toggleCommand('view.toggle-plugins', 'Toggle Plugin Marketplace', 'plugins', () =>
    isFeatureEnabled('plugin')
  ),
  {
    id: 'view.open-usage' as CommandId,
    name: 'Open Usage Stats',
    category: 'view',
    enabled: () => isFeatureEnabled('ai'),
    execute: () => {
      if (!isFeatureEnabled('ai')) {
        return { ok: false, error: 'AI feature is disabled' };
      }
      useAIProviderStore.getState().openSettings();
      return { ok: true };
    },
  },
  {
    id: 'view.toggle-wysiwyg' as CommandId,
    name: 'Toggle WYSIWYG Editor',
    category: 'view',
    shortcut: { key: 'l', modifiers: ['Mod', 'Shift'] },
    execute: () => {
      useEditorModeStore.getState().toggleMode();
      return { ok: true };
    },
  },
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
