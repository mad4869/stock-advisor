import { useMemo, useState } from 'react';
import { FundamentalData } from '@/types/screener';
import { TechnicalData, FScoreDetails, CScoreDetails, DScoreResult, DScoreDetails, SScoreDetails, TScoreResult } from '@/types/fcdst';
import { calculateFCDSTScore, computeTotalFCDSTScore, calculateTScore } from '@/lib/fcdstEngine';
import { isBankingSector } from '@/lib/sectorUtils';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { useStoryAnalysisStore, computeStoryScore } from '@/lib/storyAnalysisStore';
import { useFCDSTThresholdsStore } from '@/lib/fcdstThresholdsStore';

export interface UseFCDSTAnalysisProps {
  symbol: string;
  fundamentalData: FundamentalData;
  technicalData?: TechnicalData;
}

export interface UseFCDSTAnalysisReturn {
  fScore: number;
  fDetails: FScoreDetails;
  cScore: number;
  cDetails: CScoreDetails;
  dScore: DScoreResult;
  dDetails: DScoreDetails;
  sScore: number | 'Pending';
  sDetails: SScoreDetails;
  tScore: TScoreResult;
  totalScore: number | 'Incomplete';
  grade: string;
  isComplete: boolean;
  isBanking: boolean;
  handleChildSave: () => void;
  rawScoreObj: any; // for backwards compatibility if needed
}

/**
 * `useFCDSTAnalysis` — Core FCDS-T analysis hook.
 *
 * Wires together all FCDS-T dimensions into a single reactive result object.
 * Scores recompute automatically when:
 *  - `fundamentalData` changes (new stock loaded)
 *  - Banking metrics (NPL / CAR) are saved in `useBankingMetricsStore`
 *  - Story checklist is saved in `useStoryAnalysisStore`
 *  - Thresholds are changed in `useFCDSTThresholdsStore`
 *
 * @example
 * ```tsx
 * const { fScore, cScore, dScore, sScore, tScore, totalScore, grade, isBanking } =
 *   useFCDSTAnalysis({ symbol: 'BBCA', fundamentalData, technicalData });
 * ```
 *
 * @param symbol        - Ticker symbol (used to look up per-symbol store data)
 * @param fundamentalData - Live fundamental data from Yahoo Finance
 * @param technicalData - Optional technical data for T-score signals
 */
export function useFCDSTAnalysis({ symbol, fundamentalData, technicalData }: UseFCDSTAnalysisProps): UseFCDSTAnalysisReturn {
  const bankingMetrics = useBankingMetricsStore(state => state.metrics[symbol]);
  const storyAnalysis = useStoryAnalysisStore(state => state.analyses[symbol]);
  
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const handleChildSave = () => setLastUpdate(Date.now());

  const thresholds = useFCDSTThresholdsStore((state) => state.thresholds);
  const isBank = isBankingSector(fundamentalData.sector || null);

  const rawScore = useMemo(() => {
    return calculateFCDSTScore(
      fundamentalData,
      bankingMetrics?.npl ?? null,
      bankingMetrics?.car ?? null,
      thresholds,  // ← From store, not DEFAULT_FCDST_THRESHOLDS
      isBank
    );
  }, [fundamentalData, bankingMetrics, isBank, thresholds, lastUpdate]);

  const sScoreRaw = useMemo(() => computeStoryScore(storyAnalysis), [storyAnalysis, lastUpdate]);
  const tScoreRaw = useMemo(() => calculateTScore(technicalData), [technicalData]);

  const totalScoreObj = useMemo(() => computeTotalFCDSTScore(
    rawScore.fScore,
    rawScore.cScore,
    rawScore.dScore,
    sScoreRaw
  ), [rawScore, sScoreRaw]);

  const isComplete = totalScoreObj.totalScore !== 'Incomplete' && sScoreRaw !== 'Pending';

  return {
    fScore: rawScore.fScore,
    fDetails: rawScore.fDetails,
    cScore: rawScore.cScore,
    cDetails: rawScore.cDetails,
    dScore: rawScore.dScore,
    dDetails: rawScore.dDetails,
    sScore: sScoreRaw,
    sDetails: {
      megatrend: storyAnalysis?.megatrend.checked ?? false,
      moat: storyAnalysis?.moat.checked ?? false,
      catalyst: storyAnalysis?.catalyst.checked ?? false,
    },
    tScore: tScoreRaw,
    totalScore: totalScoreObj.totalScore,
    grade: totalScoreObj.grade,
    isComplete,
    isBanking: isBank,
    handleChildSave,
    rawScoreObj: rawScore, // included for refactoring ease
  };
}
