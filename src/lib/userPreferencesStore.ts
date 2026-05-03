import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AnalysisMode = 'guided' | 'advanced';

interface UserPreferencesState {
  analysisMode: AnalysisMode;
  setAnalysisMode: (mode: AnalysisMode) => void;
  toggleAnalysisMode: () => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      analysisMode: 'guided',
      setAnalysisMode: (mode) => set({ analysisMode: mode }),
      toggleAnalysisMode: () => set((state) => ({ analysisMode: state.analysisMode === 'guided' ? 'advanced' : 'guided' })),
    }),
    {
      name: 'stock-advisor-user-preferences',
      storage: createJSONStorage(() => localStorage),
      version: 2, // Required schema version
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Migration from old schema if needed
          return { analysisMode: 'guided', ...persistedState };
        }
        return persistedState;
      },
    }
  )
);
