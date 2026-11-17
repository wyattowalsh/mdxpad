import { beforeEach, describe, expect, it } from 'vitest';
import { useUtilityPanelStore } from './utility-panel-store';

describe('useUtilityPanelStore', () => {
  beforeEach(() => {
    useUtilityPanelStore.setState({ activeUtilityPanel: null });
  });

  it('toggles a panel open and closed', () => {
    useUtilityPanelStore.getState().toggleUtilityPanel('comments');
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('comments');
    useUtilityPanelStore.getState().toggleUtilityPanel('comments');
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBeNull();
  });

  it('replaces the open panel when another id is chosen', () => {
    useUtilityPanelStore.getState().toggleUtilityPanel('share');
    useUtilityPanelStore.getState().toggleUtilityPanel('history');
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('history');
  });
});
