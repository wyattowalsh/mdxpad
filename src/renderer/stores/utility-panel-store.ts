import { create } from 'zustand';

export type UtilityPanelId =
  | 'workspace'
  | 'export'
  | 'comments'
  | 'share'
  | 'history'
  | 'tags'
  | 'shortcuts'
  | 'publish'
  | 'semantic-search'
  | 'agent';

interface UtilityPanelState {
  readonly activeUtilityPanel: UtilityPanelId | null;
  setActiveUtilityPanel: (panel: UtilityPanelId | null) => void;
  toggleUtilityPanel: (panel: UtilityPanelId) => void;
}

export const useUtilityPanelStore = create<UtilityPanelState>((set, get) => ({
  activeUtilityPanel: null,
  setActiveUtilityPanel: (panel) => set({ activeUtilityPanel: panel }),
  toggleUtilityPanel: (panel) =>
    set({ activeUtilityPanel: get().activeUtilityPanel === panel ? null : panel }),
}));

export const selectActiveUtilityPanel = (state: UtilityPanelState): UtilityPanelId | null =>
  state.activeUtilityPanel;
