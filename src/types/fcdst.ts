export interface FScoreDetails {
  revenueGrowth: boolean;     // YoY >= 15%
  netIncomeGrowth: boolean;   // YoY >= 15%
  roe: boolean;               // >= 15%
  netProfitMargin: boolean;   // >= 10%
  grossProfitMargin: boolean; // >= 20%
  bonusFcfPass: boolean;      // FCF positive (Bonus)
}

export interface CScoreDetails {
  per: boolean;      // <= 15
  pbv: boolean;      // <= 2
  peg: boolean;      // <= 1
  evEbitda: boolean; // <= 10
}

export interface DScoreDetails {
  der: boolean | null;              // <= 1 (general), skip for banks
  currentRatio: boolean | null;     // >= 1.5, skip for banks
  interestCoverage: boolean | null; // >= 3
  // Banking-specific
  npl: boolean | null;  // <= 3%
  car: boolean | null;  // >= 12%
}

export interface SScoreDetails {
  megatrend: boolean;
  moat: boolean;
  catalyst: boolean;
}

export type TScoreResult = {
  priceAboveMA20: boolean;
  rsiFavorable: boolean;
  volumeSpike: boolean;
  mosFavorable: boolean;
  status: 'WAIT' | 'ACCUMULATE' | 'BUY ZONE' | 'Pending';
} | undefined;

export type DScoreResult = {
  status: 'complete' | 'incomplete';
  score: number;
  reason?: string;
};

export interface FCDSTScore {
  // F: Fundamental (Max 5)
  fScore: number;
  fDetails: FScoreDetails;

  // C: Cheap (Max 4)
  cScore: number;
  cDetails: CScoreDetails;

  // D: Debt (Max 3)
  dScore: DScoreResult;
  dDetails: DScoreDetails;

  // S: Story (Max 3)
  sScore: number | 'Incomplete' | 'Pending';
  sDetails: SScoreDetails;

  // T: Timing (Not scored out of 15, used for action)
  tScore?: TScoreResult;

  // Total out of 15
  totalScore: number | 'Incomplete';
  grade: 'A+' | 'B' | 'C' | 'D' | 'Incomplete' | string;
}

export interface TechnicalData {
  price: number;
  ma20: number;
  rsi14: number;
  volume: number;
  volume20dAvg: number;
  fairValue?: number; // Used for margin of safety, optional
  // Optional — used by Volume Accumulation Proxy (Commit 10)
  high?: number;
  low?: number;
}

/**
 * Volume Accumulation Proxy — heuristic estimate of smart money accumulation.
 * NOT a substitute for broker-level institutional flow data.
 */
export interface VolumeAccumulationSignal {
  /** True when volume ≥ 2× avg AND close in upper 1/3 of day's range */
  isAccumulating: boolean;
  /** today's volume / 20-day average volume */
  volumeRatio: number;
  /** 0-1 — where the close sits in (low → high) range; 1 = closed at high */
  closingPosition: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface FCDSTThresholds {
  // Fundamental
  revenueGrowthMin: number; // 15
  netIncomeGrowthMin: number; // 15
  roeMin: number; // 15
  netProfitMarginMin: number; // 10
  grossProfitMarginMin: number; // 20
  
  // Cheap
  perMax: number; // 15
  pbvMax: number; // 2
  pegMax: number; // 1
  evEbitdaMax: number; // 10

  // Debt (General)
  derMaxGeneral: number; // 1
  derMaxNonFinancial: number; // 0.5
  currentRatioMin: number; // 1.5
  interestCoverageMin: number; // 3

  // Debt (Banks)
  nplMax: number; // 3
  carMin: number; // 12
}

export const DEFAULT_FCDST_THRESHOLDS: FCDSTThresholds = {
  revenueGrowthMin: 15,
  netIncomeGrowthMin: 15,
  roeMin: 15,
  netProfitMarginMin: 10,
  grossProfitMarginMin: 20,
  perMax: 15,
  pbvMax: 2,
  pegMax: 1,
  evEbitdaMax: 10,
  derMaxGeneral: 1,
  derMaxNonFinancial: 0.5,
  currentRatioMin: 1.5,
  interestCoverageMin: 3,
  nplMax: 3,
  carMin: 12,
};
