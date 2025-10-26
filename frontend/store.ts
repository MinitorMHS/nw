import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Tab {
  id: string;
  url: string;
  title: string;
}

interface AppState {
  tabs: Tab[];
  activeTabId: string | null;
  isSettingsOpen: boolean;
  bareUrl: string;
  addTab: (url: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setBareUrl: (url: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      isSettingsOpen: false,
      bareUrl: '/v3/',
      addTab: (url) => set((state) => {
        const newTab = { id: crypto.randomUUID(), url, title: 'New Tab' };
        return { tabs: [...state.tabs, newTab], activeTabId: newTab.id };
      }),
      removeTab: (id) => set((state) => {
        const newTabs = state.tabs.filter((tab) => tab.id !== id);
        return {
          tabs: newTabs,
          activeTabId: state.activeTabId === id
            ? newTabs[0]?.id || null
            : state.activeTabId,
        };
      }),
      setActiveTab: (id) => set({ activeTabId: id }),
      setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setBareUrl: (url) => set({ bareUrl: url }),
    }),
    {
      name: 'gammaray-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ bareUrl: state.bareUrl }), // only persist the bareUrl
    }
  )
);
