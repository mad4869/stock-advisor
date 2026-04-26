import { TechnicalIndicators } from '@/types';
import { FundamentalData } from '@/types/screener';
import { AnnualFinancials, US_THRESHOLDS, IDX_THRESHOLDS } from '@/types/analysis';
import { DCFResult } from '@/types/dcf';
import { SensitivityCell } from './dcfCalculator';
import {
  CompositeScore,
  TechnicalScoreBreakdown,
  FundamentalScoreBreakdown,
  ValuationScoreBreakdown,
  RecommendationSignal,
} from '@/types/scoring';

// ============================================================================
// 1. Technical Score (Max 30)
// ============================================================================

export function calculateTechnicalScore(
  indicators: TechnicalIndicators,
  currentPrice: number
): TechnicalScoreBreakdown {
  let rsiScore = 5;
  if (indicators.rsi !== null) {
    const rsi = indicators.rsi;
    if (rsi < 30) rsiScore = 10;
    else if (rsi >= 30 && rsi < 40) rsiScore = 8;
    else if (rsi >= 40 && rsi <= 60) rsiScore = 5;
    else if (rsi > 60 && rsi <= 70) rsiScore = 3;
    else if (rsi > 70) rsiScore = 1;
  }

  let maScore = 5;
  if (indicators.sma50 !== null && indicators.sma200 !== null) {
    if (currentPrice > indicators.sma50 && indicators.sma50 > indicators.sma200) maScore = 10;
    else if (currentPrice > indicators.sma50 && indicators.sma50 <= indicators.sma200) maScore = 8;
    else if (currentPrice > indicators.sma200 && currentPrice <= indicators.sma50) maScore = 5;
    else if (currentPrice < indicators.sma200 && indicators.sma50 > indicators.sma200) maScore = 2;
    else if (indicators.sma50 < indicators.sma200) maScore = 1;
  }

  let adxScore = 5;
  if (indicators.adx !== null) {
    // We don't have DI+ and DI- in our indicator type, just ADX value.
    // If ADX > 25, trend is strong. We use price vs SMA50 to guess direction.
    if (indicators.adx > 25) {
      adxScore = (currentPrice > (indicators.sma50 || 0)) ? 10 : 2;
    } else if (indicators.adx < 20) {
      adxScore = 5;
    } else {
      adxScore = 5; // 20-25 transition
    }
  }

  let bbScore = 5;
  if (indicators.bollingerBands !== null) {
    const { upper, middle, lower } = indicators.bollingerBands;
    const range = upper - lower;
    if (range > 0) {
      const position = (currentPrice - lower) / range;
      if (position <= 0.2) bbScore = 9; // Near lower
      else if (position >= 0.8) bbScore = 2; // Near upper
      else bbScore = 5; // Middle
    }
  }

  let obvScore = 5;
  if (indicators.obvTrend === 'rising') obvScore = 9;
  else if (indicators.obvTrend === 'falling') obvScore = 2;
  else obvScore = 5;

  const rawTotal = rsiScore + maScore + adxScore + bbScore + obvScore; // Max 50
  const scaledTotal = (rawTotal / 50) * 30; // Max 30

  return {
    total: scaledTotal,
    maxTotal: 30,
    components: {
      rsi: { label: 'RSI Momentum', score: rsiScore, maxScore: 10 },
      ma: { label: 'Moving Averages', score: maScore, maxScore: 10 },
      adx: { label: 'Trend Strength (ADX)', score: adxScore, maxScore: 10 },
      bollingerBands: { label: 'Bollinger Bands', score: bbScore, maxScore: 10 },
      obv: { label: 'Volume Flow (OBV)', score: obvScore, maxScore: 10 },
    },
  };
}

// ============================================================================
// 2. Fundamental Score (Max 35)
// ============================================================================

export function calculateFundamentalScore(
  fundamentals: FundamentalData,
  financials: AnnualFinancials[]
): FundamentalScoreBreakdown {
  const thresholds = fundamentals.market === 'ID' ? IDX_THRESHOLDS : US_THRESHOLDS;
  
  // A. Valuation (Max 15)
  let valScore = 0;
  if (fundamentals.peRatio != null && fundamentals.peRatio <= thresholds.peRatio.good) valScore += 5;
  if (fundamentals.pegRatio != null && fundamentals.pegRatio < 1) valScore += 5;
  if (fundamentals.evToEbitda != null && fundamentals.evToEbitda < 10) valScore += 5;
  // Fallback for PB if one of the above is missing to help reach 15
  if (valScore < 15 && fundamentals.pbRatio != null && fundamentals.pbRatio <= thresholds.pbRatio.good) valScore += (15 - valScore > 5 ? 5 : 15 - valScore);

  // B. Profitability (Max 10)
  let profScore = 0;
  const roeTarget = fundamentals.market === 'ID' ? 12 : 15;
  if (fundamentals.roe != null && fundamentals.roe > roeTarget) profScore += 4;
  if (fundamentals.netProfitMargin != null && fundamentals.netProfitMargin > 10) profScore += 3;
  if (fundamentals.grossMargin != null && fundamentals.grossMargin > 30) profScore += 3;

  // C. Growth (Max 10)
  let growthScore = 0;
  if (fundamentals.revenueGrowth != null && fundamentals.revenueGrowth > 10) growthScore += 4;
  if (fundamentals.earningsGrowth != null && fundamentals.earningsGrowth > 10) growthScore += 3;
  
  // Calculate 3Y Revenue CAGR if we have financials
  let cagr3y = null;
  if (financials.length >= 4) {
    const start = financials[financials.length - 4].totalRevenue;
    const end = financials[financials.length - 1].totalRevenue;
    if (start && end && start > 0) {
      cagr3y = (Math.pow(end / start, 1 / 3) - 1) * 100;
    }
  }
  if (cagr3y != null && cagr3y > 0) growthScore += 3;

  // D. Health (Max 10)
  let healthScore = 0;
  if (fundamentals.debtToEquity != null && fundamentals.debtToEquity < 1) healthScore += 3;
  if (fundamentals.currentRatio != null && fundamentals.currentRatio > 1.5) healthScore += 3;
  if (fundamentals.freeCashFlow != null && fundamentals.freeCashFlow > 0) healthScore += 2;
  
  // Interest Coverage = Operating Income / Interest Expense
  const latestFinancials = financials[financials.length - 1];
  if (latestFinancials && latestFinancials.operatingIncome && latestFinancials.interestExpense) {
    const coverage = latestFinancials.operatingIncome / latestFinancials.interestExpense;
    if (coverage > 3) healthScore += 2;
  }

  // E. Red Flags (Deductions, up to -10)
  let redFlagsScore = 0;
  let redFlagsCount = 0;
  if (fundamentals.debtToEquity != null && fundamentals.debtToEquity > 3) redFlagsCount++;
  if (fundamentals.currentRatio != null && fundamentals.currentRatio < 0.8) redFlagsCount++;
  if (fundamentals.netProfitMargin != null && fundamentals.netProfitMargin < 0) redFlagsCount++;
  if (fundamentals.freeCashFlow != null && fundamentals.freeCashFlow < 0) redFlagsCount++;
  if (cagr3y != null && cagr3y < -5) redFlagsCount++;
  
  redFlagsScore = Math.max(-10, redFlagsCount * -2);

  // Total
  const rawTotal = valScore + profScore + growthScore + healthScore + redFlagsScore; // Max 45
  const scaledTotal = Math.max(0, (rawTotal / 45) * 35); // Max 35

  return {
    total: scaledTotal,
    maxTotal: 35,
    components: {
      valuation: { label: 'Valuation', score: valScore, maxScore: 15 },
      profitability: { label: 'Profitability', score: profScore, maxScore: 10 },
      growth: { label: 'Growth', score: growthScore, maxScore: 10 },
      health: { label: 'Financial Health', score: healthScore, maxScore: 10 },
      redFlags: { label: 'Red Flags Deduction', score: redFlagsScore, maxScore: 0, description: `${redFlagsCount} red flags found` },
    },
  };
}

// ============================================================================
// 3. Valuation Score (Max 35)
// ============================================================================

export function calculateValuationScore(
  dcfResult: DCFResult | null,
  matrix: SensitivityCell[][] | null,
  currentPrice: number
): ValuationScoreBreakdown {
  if (!dcfResult || currentPrice <= 0) {
    return {
      total: 0,
      maxTotal: 35,
      components: {
        marginOfSafety: { label: 'DCF Margin of Safety', score: 0, maxScore: 35, description: 'DCF data unavailable' },
        sensitivityAdjustment: { label: 'Sensitivity Adjustment', score: 0, maxScore: 0 },
      },
    };
  }

  const iv = dcfResult.intrinsicValuePerShare;
  const mos = ((iv - currentPrice) / currentPrice) * 100;

  let mosScore = 0;
  if (mos > 40) mosScore = 35;
  else if (mos > 30) mosScore = 30;
  else if (mos > 20) mosScore = 25;
  else if (mos > 10) mosScore = 18;
  else if (mos > 0) mosScore = 12;
  else if (mos > -10) mosScore = 6;
  else mosScore = 2;

  let adjustment = 0;
  if (matrix && matrix.length > 0) {
    let totalCells = 0;
    let undervaluedCells = 0;
    
    matrix.forEach(row => {
      row.forEach(val => {
        totalCells++;
        if (val.intrinsicValue > currentPrice) undervaluedCells++;
      });
    });

    const percentUndervalued = (undervaluedCells / totalCells) * 100;
    if (percentUndervalued > 80) adjustment = 0;
    else if (percentUndervalued >= 50) adjustment = -2;
    else adjustment = -5;
  }

  const finalScore = Math.max(0, Math.min(35, mosScore + adjustment));

  return {
    total: finalScore,
    maxTotal: 35,
    components: {
      marginOfSafety: { label: 'DCF Margin of Safety', score: mosScore, maxScore: 35, description: `MoS: ${mos.toFixed(1)}%` },
      sensitivityAdjustment: { label: 'Sensitivity Adjustment', score: adjustment, maxScore: 0 },
    },
  };
}

// ============================================================================
// 4. Composite Scoring Engine
// ============================================================================

export function generateRecommendation(totalScore: number): RecommendationSignal {
  if (totalScore >= 85) return 'STRONG BUY';
  if (totalScore >= 70) return 'BUY';
  if (totalScore >= 55) return 'HOLD';
  if (totalScore >= 40) return 'UNDERPERFORM';
  return 'AVOID';
}

export function generateSummaryText(
  symbol: string,
  totalScore: number,
  rec: RecommendationSignal,
  tech: TechnicalScoreBreakdown,
  fund: FundamentalScoreBreakdown,
  val: ValuationScoreBreakdown
): string {
  const techQuality = tech.total >= 20 ? 'strong bullish momentum' : tech.total >= 12 ? 'neutral technical indicators' : 'bearish momentum';
  const fundQuality = fund.total >= 25 ? 'excellent fundamentals' : fund.total >= 15 ? 'fair fundamentals' : 'weak fundamentals';
  const valQuality = val.total >= 25 ? 'significantly undervalued by DCF' : val.total >= 15 ? 'fairly valued' : 'overvalued';

  return `${symbol} scores ${totalScore.toFixed(0)}/100 (${rec}). The stock presents ${fundQuality} and is currently ${valQuality}, while showing ${techQuality}.`;
}
