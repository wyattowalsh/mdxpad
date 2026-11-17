import { create } from 'zustand';

interface StatusMessageState {
  readonly message: string;
  show: (message: string) => void;
}

export const useStatusMessageStore = create<StatusMessageState>()((set) => ({
  message: '',
  show: (message) => set({ message }),
}));
