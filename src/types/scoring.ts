import { Market } from './index';

export interface ScoreComponent {
  label: string;
  score: number;
  maxScore: number;
  description?: string;
}

export interface TechnicalScoreBreakdown {
  total: number;
  maxTotal: 30;
  components: {
    rsi: ScoreComponent;
    ma: ScoreComponent;
    adx: ScoreComponent;
    bollingerBands: ScoreComponent;
    obv: ScoreComponent;
  };
}

export interface FundamentalScoreBreakdown {
  total: number;
  maxTotal: 35;
  components: {
    valuation: ScoreComponent;
    profitability: ScoreComponent;
    growth: ScoreComponent;
    health: ScoreComponent;
    redFlags: ScoreComponent;
  };
}

export interface ValuationScoreBreakdown {
  total: number;
  maxTotal: 35;
  components: {
    marginOfSafety: ScoreComponent;
    sensitivityAdjustment: ScoreComponent;
  };
}

export type RecommendationSignal = 'STRONG BUY' | 'BUY' | 'HOLD' | 'UNDERPERFORM' | 'AVOID';

export interface CompositeScore {
  symbol: string;
  market: Market;
  totalScore: number; // 0 to 100
  recommendation: RecommendationSignal;
  summary: string;
  breakdown: {
    technical: TechnicalScoreBreakdown;
    fundamental: FundamentalScoreBreakdown;
    valuation: ValuationScoreBreakdown;
  };
}
