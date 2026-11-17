import { beforeEach, describe, expect, it } from 'vitest';
import type { CommandContext } from '@shared/types/commands';
import { PANEL_COMMANDS } from '../panel-commands';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';
import { useEditorModeStore } from '@renderer/stores/editor-mode-store';

const context = {
  editor: null,
  document: { fileId: null, filePath: null, content: '', isDirty: false },
  ui: { previewVisible: true, sidebarVisible: true, zoomLevel: 100 },
  platform: { isMac: true, isWindows: false, isLinux: false },
  api: {},
  notify: () => undefined,
} as unknown as CommandContext;

describe('PANEL_COMMANDS', () => {
  beforeEach(() => {
    useUtilityPanelStore.setState({ activeUtilityPanel: null });
  });

  it('uses view command ids without shortcuts', () => {
    expect(PANEL_COMMANDS.map((command) => command.id)).toEqual([
      'view.toggle-workspace',
      'view.toggle-export',
      'view.toggle-comments',
      'view.toggle-share',
      'view.toggle-history',
      'view.toggle-tags',
      'view.toggle-shortcuts',
      'view.toggle-publish',
      'view.toggle-semantic-search',
      'view.toggle-agent',
      'view.toggle-wysiwyg',
    ]);
    expect(PANEL_COMMANDS.every((command) => command.shortcut === undefined)).toBe(true);
  });

  it('opens the comments panel', async () => {
    const comments = PANEL_COMMANDS.find((command) => command.id === 'view.toggle-comments');
    await comments?.execute(context);
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('comments');
  });

  it('opens the agent panel', async () => {
    const command = PANEL_COMMANDS.find((item) => item.id === 'view.toggle-agent');
    await command?.execute(context);
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('agent');
  });

  it('toggles the editor between source and WYSIWYG', async () => {
    useEditorModeStore.getState().setMode('source');
    const command = PANEL_COMMANDS.find((item) => item.id === 'view.toggle-wysiwyg');
    await command?.execute(context);
    expect(useEditorModeStore.getState().mode).toBe('wysiwyg');
    await command?.execute(context);
    expect(useEditorModeStore.getState().mode).toBe('source');
  });
});
