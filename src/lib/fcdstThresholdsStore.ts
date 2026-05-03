import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FCDSTThresholds, DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';

interface FCDSTThresholdsState {
  thresholds: FCDSTThresholds;
  setThresholds: (t: Partial<FCDSTThresholds>) => void;
  resetToDefaults: () => void;
}

export const useFCDSTThresholdsStore = create<FCDSTThresholdsState>()(
  persist(
    (set) => ({
      thresholds: { ...DEFAULT_FCDST_THRESHOLDS },

      setThresholds: (partial) =>
        set((state) => ({
          thresholds: { ...state.thresholds, ...partial },
        })),

      resetToDefaults: () =>
        set({ thresholds: { ...DEFAULT_FCDST_THRESHOLDS } }),
    }),
    {
      name: 'fcdst-thresholds-storage',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return { thresholds: { ...DEFAULT_FCDST_THRESHOLDS } };
        }
        return persistedState;
      },
    }
  )
);
