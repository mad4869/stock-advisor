import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StoryAnalysis {
  symbol: string;
  megatrend: { checked: boolean; justification: string };
  moat: { checked: boolean; justification: string };
  catalyst: { checked: boolean; justification: string };
  lastUpdated: number;
}

interface StoryAnalysisState {
  analyses: Record<string, StoryAnalysis>;
  saveAnalysis: (symbol: string, analysis: Omit<StoryAnalysis, 'symbol' | 'lastUpdated'>) => void;
  getAnalysis: (symbol: string) => StoryAnalysis | undefined;
}

export const useStoryAnalysisStore = create<StoryAnalysisState>()(
  persist(
    (set, get) => ({
      analyses: {},
      saveAnalysis: (symbol, data) => {
        set((state) => ({
          analyses: {
            ...state.analyses,
            [symbol]: {
              ...data,
              symbol,
              lastUpdated: Date.now(),
            },
          },
        }));
      },
      getAnalysis: (symbol) => {
        return get().analyses[symbol];
      },
    }),
    {
      name: 'story-analysis-storage',
      version: 2,
    }
  )
);

/**
 * Compute the S-Score (Story / Moat) from a saved StoryAnalysis.
 *
 * Scoring rules:
 *  - Each of the 3 dimensions (megatrend, moat, catalyst) contributes 1 point
 *  - A point is awarded only if the item is `checked: true` AND the justification
 *    is non-empty (non-whitespace)
 *  - Returns 'Pending' if no analysis has been saved for the symbol yet
 *
 * @param analysis - The saved StoryAnalysis object, or undefined if not yet saved.
 * @returns 0-3 numeric score, or 'Pending' when analysis is absent.
 */
export function computeStoryScore(analysis: StoryAnalysis | undefined): number | 'Pending' {
  if (!analysis) return 'Pending';
  
  let score = 0;
  if (analysis.megatrend.checked && analysis.megatrend.justification.trim().length > 0) score++;
  if (analysis.moat.checked && analysis.moat.justification.trim().length > 0) score++;
  if (analysis.catalyst.checked && analysis.catalyst.justification.trim().length > 0) score++;
  
  return score;
}
