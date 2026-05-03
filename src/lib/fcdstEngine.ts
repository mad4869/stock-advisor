import { FundamentalData } from '@/types/screener';
import { FCDSTScore, FCDSTThresholds, DEFAULT_FCDST_THRESHOLDS, DScoreResult, TechnicalData, TScoreResult, VolumeAccumulationSignal } from '@/types/fcdst';
import { isBankingSector } from './sectorUtils';

/**
 * Calculate the F (Fundamental), C (Cheap), and D (Debt) components of an FCDS-T score.
 *
 * The S (Story) and T (Timing) components are computed separately because they
 * depend on manual user inputs (StoryChecklist, TechnicalData) rather than API data.
 *
 * @param data          - Fundamental stock data from the Yahoo Finance API
 * @param manualNPL     - Non-Performing Loan ratio (%) entered manually; required for banks
 * @param manualCAR     - Capital Adequacy Ratio (%) entered manually; required for banks
 * @param thresholds    - FCDS-T thresholds to use; defaults to DEFAULT_FCDST_THRESHOLDS.
 *                        Use `useFCDSTThresholdsStore` to source user-configured values.
 * @param isBankOverride - Explicitly set bank classification; if omitted, derived from `data.sector`
 * @returns Partial FCDSTScore containing fScore, fDetails, cScore, cDetails, dScore, dDetails
 */
export function calculateFCDSTScore(
  data: FundamentalData,
  manualNPL: number | null = null,
  manualCAR: number | null = null,
  thresholds: FCDSTThresholds = DEFAULT_FCDST_THRESHOLDS,
  isBankOverride?: boolean
): Pick<FCDSTScore, 'fScore' | 'fDetails' | 'cScore' | 'cDetails' | 'dScore' | 'dDetails'> {
  
  const isBank = isBankOverride ?? isBankingSector(data.sector || null);
  
  // ==========================================
  // [F] FUNDAMENTAL (Max 5)
  // ==========================================
  const revGrowthPass = data.revenueGrowth != null && data.revenueGrowth >= thresholds.revenueGrowthMin;
  const netIncGrowthPass = data.earningsGrowth != null && data.earningsGrowth >= thresholds.netIncomeGrowthMin;
  const roePass = data.roe != null && data.roe >= thresholds.roeMin;
  const npmPass = data.netProfitMargin != null && data.netProfitMargin >= thresholds.netProfitMarginMin;
  const gpmPass = data.grossMargin != null && data.grossMargin >= thresholds.grossProfitMarginMin;
  const bonusFcfPass = data.freeCashFlow != null && data.freeCashFlow > 0;

  let fRaw = 0;
  if (revGrowthPass) fRaw += 1;
  if (netIncGrowthPass) fRaw += 1;
  if (roePass) fRaw += 1;
  if (npmPass) fRaw += 1;
  if (gpmPass) fRaw += 1;
  if (bonusFcfPass) fRaw += 1;

  const fScore = Math.min(5, fRaw); // Max is 5

  const fDetails = {
    revenueGrowth: revGrowthPass,
    netIncomeGrowth: netIncGrowthPass,
    roe: roePass,
    netProfitMargin: npmPass,
    grossProfitMargin: gpmPass,
    bonusFcfPass: bonusFcfPass,
  };

  // ==========================================
  // [C] CHEAP (Max 4)
  // ==========================================
  // A lower value is better for valuation metrics.
  // Missing data counts as fail (false).
  const perPass = data.peRatio != null && data.peRatio > 0 && data.peRatio <= thresholds.perMax;
  const pbvPass = data.pbRatio != null && data.pbRatio > 0 && data.pbRatio <= thresholds.pbvMax;
  const pegPass = data.pegRatio != null && data.pegRatio > 0 && data.pegRatio <= thresholds.pegMax;
  const evEbitdaPass = data.evToEbitda != null && data.evToEbitda > 0 && data.evToEbitda <= thresholds.evEbitdaMax;

  let cScore = 0;
  if (perPass) cScore += 1;
  if (pbvPass) cScore += 1;
  if (pegPass) cScore += 1;
  if (evEbitdaPass) cScore += 1;

  const cDetails = {
    per: perPass,
    pbv: pbvPass,
    peg: pegPass,
    evEbitda: evEbitdaPass,
  };

  // ==========================================
  // [D] DEBT (Max 3)
  // ==========================================
  let dScore: DScoreResult = { status: 'complete', score: 0 };
  let dDetails = {
    der: null as boolean | null,
    currentRatio: null as boolean | null,
    interestCoverage: null as boolean | null,
    npl: null as boolean | null,
    car: null as boolean | null,
  };

  if (isBank) {
    if (manualNPL == null || manualCAR == null) {
      dScore = {
        status: 'incomplete',
        score: 0,
        reason: 'Bank sector requires manual input for NPL and CAR',
      };
    } else {
      let score = 0;
      dDetails.npl = manualNPL <= thresholds.nplMax;
      if (dDetails.npl) score += 1.5;
      
      dDetails.car = manualCAR >= thresholds.carMin;
      if (dDetails.car) score += 1.5;
      
      dScore = { status: 'complete', score };
    }
  } else {
    let score = 0;
    if (data.debtToEquity != null) {
      dDetails.der = data.debtToEquity <= thresholds.derMaxGeneral;
      if (dDetails.der) score += 1;
    }

    if (data.currentRatio != null) {
      dDetails.currentRatio = data.currentRatio >= thresholds.currentRatioMin;
      if (dDetails.currentRatio) score += 1;
    }

    // @ts-ignore - Assuming interestCoverage is added to data later
    if (data.interestCoverage != null) {
      // @ts-ignore
      dDetails.interestCoverage = data.interestCoverage >= thresholds.interestCoverageMin;
      if (dDetails.interestCoverage) score += 1;
    }
    dScore = { status: 'complete', score };
  }

  return {
    fScore,
    fDetails,
    cScore,
    cDetails,
    dScore,
    dDetails,
  };
}

export function computeTotalFCDSTScore(
  fScore: number,
  cScore: number,
  dScoreResult: DScoreResult,
  sScore: number | 'Incomplete' | 'Pending' = 'Pending'
): { totalScore: number | 'Incomplete'; grade: FCDSTScore['grade'] } {
  if (dScoreResult.status === 'incomplete' || sScore === 'Incomplete') {
    return { totalScore: 'Incomplete', grade: 'Incomplete' };
  }

  const isPending = sScore === 'Pending';
  const numericSScore = isPending ? 0 : (sScore as number);
  const total = fScore + cScore + dScoreResult.score + numericSScore;
  
  let grade = 'D';
  if (total >= 13) grade = 'A+';
  else if (total >= 10) grade = 'B';
  else if (total >= 7) grade = 'C';

  if (isPending) {
    grade = `${grade} (Pending Story)`;
  }

  return { totalScore: total, grade };
}

export function calculateTScore(data?: TechnicalData): TScoreResult {
  if (!data) return undefined;

  const priceAboveMA20 = data.price >= data.ma20;
  const rsiFavorable = data.rsi14 >= 40 && data.rsi14 <= 60;
  const volumeSpike = data.volume > data.volume20dAvg;
  
  let mosFavorable = false;
  if (data.fairValue && data.fairValue > 0) {
    const mos = (data.fairValue - data.price) / data.fairValue;
    mosFavorable = mos >= 0.3; // >= 30% margin of safety
  }

  let count = 0;
  if (priceAboveMA20) count++;
  if (rsiFavorable) count++;
  if (volumeSpike) count++;
  if (mosFavorable) count++;

  let status: 'WAIT' | 'ACCUMULATE' | 'BUY ZONE' | 'Pending' = 'WAIT';
  if (count === 4) status = 'BUY ZONE';
  else if (count === 3) status = 'ACCUMULATE';
  else if (count === 2) status = 'WAIT';
  else status = 'WAIT'; // 0-1/4 -> WAIT (or NOT YET, but type says WAIT)

  return {
    priceAboveMA20,
    rsiFavorable,
    volumeSpike,
    mosFavorable,
    status,
  };
}


export function calculateVolumeAccumulation(data: TechnicalData): VolumeAccumulationSignal {
  const volumeRatio =
    data.volume20dAvg > 0 ? data.volume / data.volume20dAvg : 0;

  // Guard: no intraday range (high == low or missing) → closingPosition = 0
  const high = data.high ?? data.price;
  const low  = data.low  ?? data.price;
  const range = high - low;
  const closingPosition = range > 0 ? (data.price - low) / range : 0;

  const isAccumulating = volumeRatio >= 2.0 && closingPosition >= 0.67;

  const confidence: 'high' | 'medium' | 'low' =
    volumeRatio >= 3.0 && closingPosition >= 0.8
      ? 'high'
      : isAccumulating
      ? 'medium'
      : 'low';

  return { isAccumulating, volumeRatio, closingPosition, confidence };
}
