/**
 * Fundamental Quality Scorer
 *
 * Converts the rich ComprehensiveAnalysis data (already fetched during the
 * red-flag stage of the screener) into a 0-100 quality score.
 *
 * No additional API calls are required — data is pulled from
 * ComprehensiveAnalysis which is already fetched in swingScreener.ts
 * when taPass = true.
 *
 * Score Breakdown (100 pts total):
 *   Valuation   20 pts — P/E, P/B, PEG vs market-specific thresholds
 *   Growth      20 pts — Revenue growth, earnings growth, EPS revision
 *   Profitability 15 pts — ROE, net margin, operating margin
 *   Health      15 pts — D/E, current ratio, interest coverage
 *   Cash Flow   15 pts — FCF margin, FCF yield
 *   Analyst     15 pts — Price target upside, recommendation consensus
 */

import { ComprehensiveAnalysis } from '@/types/analysis';
import { Market } from '@/types';

export interface FundamentalScore {
  total: number;               // 0–100 composite
  valuation: number;           // 0–20
  growth: number;              // 0–20
  profitability: number;       // 0–15
  health: number;              // 0–15
  cashFlow: number;            // 0–15
  analyst: number;             // 0–15

  // Key derived metrics surfaced for display
  analystUpside: number | null;          // % upside to analyst mean target
  analystConsensus: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' | null;
  shortInterestPct: number | null;       // short % of float (from ks, may be null)
  epsRevisionUp: boolean | null;         // true = EPS estimate revised up, false = down, null = no data
  daysToEarnings: number | null;         // null = no upcoming earnings known

  grade: 'A' | 'B' | 'C' | 'D' | 'F'; // letter grade
  signals: string[];                     // human-readable positive signals
  warnings: string[];                    // fundamental cautions (non-blocking)
}

// Market-specific thresholds (mirrors ValuationMetrics.tsx thresholds)
const THRESHOLDS = {
  US: {
    pe: { good: 15, fair: 25 },
    pb: { good: 1.5, fair: 3 },
    peg: { good: 1.0, fair: 1.5 },
    roe: { good: 15, fair: 8 },          // %
    netMargin: { good: 10, fair: 5 },    // %
    operatingMargin: { good: 15, fair: 8 },
    revenueGrowth: { strong: 15, good: 8 }, // %
    earningsGrowth: { strong: 20, good: 10 },
    de: { safe: 1.0, caution: 2.0 },
    currentRatio: { safe: 1.5, min: 1.0 },
    interestCoverage: { safe: 5, min: 2 },
    fcfMargin: { good: 10, fair: 5 },    // %
    fcfYield: { good: 5, fair: 2.5 },    // %
    analystUpside: { strong: 25, good: 15 }, // % upside to mean target
  },
  ID: {
    pe: { good: 12, fair: 20 },
    pb: { good: 1.2, fair: 2.5 },
    peg: { good: 0.8, fair: 1.3 },
    roe: { good: 12, fair: 6 },
    netMargin: { good: 8, fair: 4 },
    operatingMargin: { good: 12, fair: 6 },
    revenueGrowth: { strong: 12, good: 6 },
    earningsGrowth: { strong: 15, good: 8 },
    de: { safe: 1.5, caution: 3.0 },    // IDX more lenient on leverage
    currentRatio: { safe: 1.5, min: 1.0 },
    interestCoverage: { safe: 4, min: 2 },
    fcfMargin: { good: 8, fair: 4 },
    fcfYield: { good: 4, fair: 2 },
    analystUpside: { strong: 30, good: 20 }, // IDX targets tend to be wider
  },
};

/**
 * Compute a 0–100 fundamental quality score from a ComprehensiveAnalysis.
 */
export function computeFundamentalScore(
  analysis: ComprehensiveAnalysis,
  market: Market
): FundamentalScore {
  const t = THRESHOLDS[market];
  const f = analysis.fundamentals;
  const signals: string[] = [];
  const warnings: string[] = [];

  // ── 1. Valuation Score (max 20) ─────────────────────────────────────
  let valuationScore = 0;

  // P/E (max 8 pts)
  if (f.peRatio != null && f.peRatio > 0) {
    if (f.peRatio <= t.pe.good) {
      valuationScore += 8;
      signals.push(`Low P/E (${f.peRatio.toFixed(1)}x — undervalued range)`);
    } else if (f.peRatio <= t.pe.fair) {
      valuationScore += 4;
    } else {
      warnings.push(`High P/E (${f.peRatio.toFixed(1)}x)`);
    }
  } else if (f.peRatio == null) {
    valuationScore += 4; // neutral — no penalty for missing data
  }

  // P/B (max 6 pts)
  if (f.pbRatio != null && f.pbRatio > 0) {
    if (f.pbRatio <= t.pb.good) {
      valuationScore += 6;
      signals.push(`Low P/B (${f.pbRatio.toFixed(2)}x)`);
    } else if (f.pbRatio <= t.pb.fair) {
      valuationScore += 3;
    } else {
      warnings.push(`High P/B (${f.pbRatio.toFixed(2)}x)`);
    }
  } else {
    valuationScore += 3;
  }

  // PEG (max 6 pts) — only if available
  if (f.pegRatio != null && f.pegRatio > 0) {
    if (f.pegRatio <= t.peg.good) {
      valuationScore += 6;
      signals.push(`Attractive PEG (${f.pegRatio.toFixed(2)}x)`);
    } else if (f.pegRatio <= t.peg.fair) {
      valuationScore += 3;
    }
    // High PEG — no bonus
  } else {
    valuationScore += 3; // neutral
  }

  valuationScore = Math.min(20, valuationScore);

  // ── 2. Growth Score (max 20) ─────────────────────────────────────────
  let growthScore = 0;

  // Revenue growth (max 8 pts)
  if (f.revenueGrowth != null) {
    if (f.revenueGrowth >= t.revenueGrowth.strong) {
      growthScore += 8;
      signals.push(`Strong revenue growth (+${f.revenueGrowth.toFixed(1)}% YoY)`);
    } else if (f.revenueGrowth >= t.revenueGrowth.good) {
      growthScore += 5;
      signals.push(`Solid revenue growth (+${f.revenueGrowth.toFixed(1)}% YoY)`);
    } else if (f.revenueGrowth >= 0) {
      growthScore += 2;
    } else {
      warnings.push(`Revenue declining (${f.revenueGrowth.toFixed(1)}% YoY)`);
    }
  } else {
    growthScore += 3;
  }

  // Earnings growth (max 7 pts)
  if (f.earningsGrowth != null) {
    if (f.earningsGrowth >= t.earningsGrowth.strong) {
      growthScore += 7;
      signals.push(`Strong earnings growth (+${f.earningsGrowth.toFixed(1)}% YoY)`);
    } else if (f.earningsGrowth >= t.earningsGrowth.good) {
      growthScore += 4;
    } else if (f.earningsGrowth >= 0) {
      growthScore += 1;
    } else {
      warnings.push(`Earnings declining (${f.earningsGrowth.toFixed(1)}% YoY)`);
    }
  } else {
    growthScore += 3;
  }

  // EPS growth next 5Y (max 5 pts) — forward-looking
  if (f.epsGrowthNext5Y != null && f.epsGrowthNext5Y > 0) {
    if (f.epsGrowthNext5Y >= 15) {
      growthScore += 5;
      signals.push(`Strong 5Y EPS growth forecast (+${f.epsGrowthNext5Y.toFixed(1)}%/yr)`);
    } else if (f.epsGrowthNext5Y >= 8) {
      growthScore += 3;
    } else {
      growthScore += 1;
    }
  } else {
    growthScore += 2;
  }

  growthScore = Math.min(20, growthScore);

  // ── 3. Profitability Score (max 15) ──────────────────────────────────
  let profitabilityScore = 0;

  // ROE (max 6 pts)
  if (f.roe != null) {
    if (f.roe >= t.roe.good) {
      profitabilityScore += 6;
      signals.push(`Strong ROE (${f.roe.toFixed(1)}%)`);
    } else if (f.roe >= t.roe.fair) {
      profitabilityScore += 3;
    } else if (f.roe < 0) {
      warnings.push(`Negative ROE (${f.roe.toFixed(1)}%)`);
    }
  } else {
    profitabilityScore += 3;
  }

  // Net margin (max 5 pts)
  if (f.netProfitMargin != null) {
    if (f.netProfitMargin >= t.netMargin.good) {
      profitabilityScore += 5;
      signals.push(`High net margin (${f.netProfitMargin.toFixed(1)}%)`);
    } else if (f.netProfitMargin >= t.netMargin.fair) {
      profitabilityScore += 3;
    } else if (f.netProfitMargin < 0) {
      warnings.push(`Negative net margin (${f.netProfitMargin.toFixed(1)}%)`);
    }
  } else {
    profitabilityScore += 2;
  }

  // Operating margin (max 4 pts)
  if (f.operatingMargin != null) {
    if (f.operatingMargin >= t.operatingMargin.good) {
      profitabilityScore += 4;
    } else if (f.operatingMargin >= t.operatingMargin.fair) {
      profitabilityScore += 2;
    }
  } else {
    profitabilityScore += 2;
  }

  profitabilityScore = Math.min(15, profitabilityScore);

  // ── 4. Financial Health Score (max 15) ───────────────────────────────
  let healthScore = 0;

  // Debt-to-Equity (max 6 pts)
  if (f.debtToEquity != null) {
    if (f.debtToEquity <= t.de.safe) {
      healthScore += 6;
      signals.push(`Conservative leverage (D/E ${f.debtToEquity.toFixed(2)}x)`);
    } else if (f.debtToEquity <= t.de.caution) {
      healthScore += 3;
    } else {
      warnings.push(`High leverage (D/E ${f.debtToEquity.toFixed(2)}x)`);
    }
  } else {
    healthScore += 3;
  }

  // Current ratio (max 5 pts)
  if (f.currentRatio != null) {
    if (f.currentRatio >= t.currentRatio.safe) {
      healthScore += 5;
      signals.push(`Strong liquidity (current ratio ${f.currentRatio.toFixed(2)}x)`);
    } else if (f.currentRatio >= t.currentRatio.min) {
      healthScore += 2;
    }
    // < 1.0 is already caught by danger red flag
  } else {
    healthScore += 2;
  }

  // Interest coverage (max 4 pts)
  if (analysis.interestCoverage != null) {
    if (analysis.interestCoverage >= t.interestCoverage.safe) {
      healthScore += 4;
      signals.push(`Strong interest coverage (${analysis.interestCoverage.toFixed(1)}x)`);
    } else if (analysis.interestCoverage >= t.interestCoverage.min) {
      healthScore += 2;
    }
    // < 2x is already caught by danger red flag
  } else {
    healthScore += 2;
  }

  healthScore = Math.min(15, healthScore);

  // ── 5. Cash Flow Score (max 15) ──────────────────────────────────────
  let cashFlowScore = 0;

  // FCF margin (max 8 pts)
  if (analysis.fcfMargin != null) {
    if (analysis.fcfMargin >= t.fcfMargin.good) {
      cashFlowScore += 8;
      signals.push(`Excellent FCF margin (${analysis.fcfMargin.toFixed(1)}%)`);
    } else if (analysis.fcfMargin >= t.fcfMargin.fair) {
      cashFlowScore += 5;
      signals.push(`Positive FCF margin (${analysis.fcfMargin.toFixed(1)}%)`);
    } else if (analysis.fcfMargin != null && analysis.fcfMargin > 0) {
      cashFlowScore += 2;
    } else if (analysis.fcfMargin != null && analysis.fcfMargin < 0) {
      warnings.push(`Negative FCF margin (${analysis.fcfMargin.toFixed(1)}%)`);
    }
  } else {
    cashFlowScore += 3;
  }

  // FCF yield (max 7 pts)
  if (analysis.fcfYield != null) {
    if (analysis.fcfYield >= t.fcfYield.good) {
      cashFlowScore += 7;
      signals.push(`High FCF yield (${analysis.fcfYield.toFixed(1)}%)`);
    } else if (analysis.fcfYield >= t.fcfYield.fair) {
      cashFlowScore += 4;
    } else if (analysis.fcfYield != null && analysis.fcfYield > 0) {
      cashFlowScore += 2;
    }
  } else {
    cashFlowScore += 3;
  }

  cashFlowScore = Math.min(15, cashFlowScore);

  // ── 6. Analyst Score (max 15) ────────────────────────────────────────
  let analystScore = 0;
  let analystUpside: number | null = null;
  let analystConsensus: FundamentalScore['analystConsensus'] = null;

  const { analystRating } = analysis;
  const currentPrice = f.price;

  // Analyst target upside (max 8 pts)
  if (analystRating.targetMeanPrice != null && currentPrice != null && currentPrice > 0) {
    analystUpside = ((analystRating.targetMeanPrice - currentPrice) / currentPrice) * 100;

    if (analystUpside >= t.analystUpside.strong) {
      analystScore += 8;
      signals.push(`Strong analyst upside (+${analystUpside.toFixed(1)}% to mean target)`);
    } else if (analystUpside >= t.analystUpside.good) {
      analystScore += 5;
      signals.push(`Analyst upside (+${analystUpside.toFixed(1)}% to mean target)`);
    } else if (analystUpside > 0) {
      analystScore += 2;
    } else if (analystUpside < -10) {
      warnings.push(`Analyst target below current price (${analystUpside.toFixed(1)}%)`);
    }
  } else {
    analystScore += 3; // neutral — no data
  }

  // Analyst consensus (max 7 pts)
  const totalRecs = analystRating.buy + analystRating.hold + analystRating.sell;
  if (totalRecs > 0) {
    const buyPct = (analystRating.buy / totalRecs) * 100;
    const sellPct = (analystRating.sell / totalRecs) * 100;

    if (buyPct >= 70) {
      analystScore += 7;
      analystConsensus = 'strong_buy';
      signals.push(`Strong analyst consensus: ${analystRating.buy} Buy / ${analystRating.hold} Hold / ${analystRating.sell} Sell`);
    } else if (buyPct >= 50) {
      analystScore += 5;
      analystConsensus = 'buy';
      signals.push(`Positive analyst consensus (${buyPct.toFixed(0)}% buy)`);
    } else if (sellPct >= 50) {
      analystScore += 0;
      analystConsensus = 'sell';
      warnings.push(`Analyst consensus bearish (${sellPct.toFixed(0)}% sell)`);
    } else {
      analystScore += 2;
      analystConsensus = 'hold';
    }
  } else {
    analystScore += 3;
  }

  // Insider activity check (contributes to institutional/analyst sentiment block)
  if (analysis.insiderActivity) {
    const { netSharesBought90d } = analysis.insiderActivity;
    if (netSharesBought90d != null && netSharesBought90d > 10000) {
      analystScore += 2;
      signals.push(`Bullish insider buying (+${netSharesBought90d.toLocaleString()} shares net in last 90 days)`);
    } else if (netSharesBought90d != null && netSharesBought90d < -100000) {
      analystScore = Math.max(0, analystScore - 1);
    }
  }

  analystScore = Math.min(15, analystScore);

  // ── Total ─────────────────────────────────────────────────────────────
  const total = Math.round(
    valuationScore + growthScore + profitabilityScore + healthScore + cashFlowScore + analystScore
  );

  let grade: FundamentalScore['grade'];
  if (total >= 80) grade = 'A';
  else if (total >= 65) grade = 'B';
  else if (total >= 50) grade = 'C';
  else if (total >= 35) grade = 'D';
  else grade = 'F';

  return {
    total,
    valuation: valuationScore,
    growth: growthScore,
    profitability: profitabilityScore,
    health: healthScore,
    cashFlow: cashFlowScore,
    analyst: analystScore,
    analystUpside,
    analystConsensus,
    shortInterestPct: null, // populated by caller from raw quoteSummary (defaultKeyStatistics)
    epsRevisionUp: null,    // populated by caller from earningsTrend
    daysToEarnings: null,   // populated by caller from calendarEvents
    grade,
    signals,
    warnings,
  };
}

/**
 * Derive days-to-next-earnings from a list of upcoming earnings dates.
 * Returns null if no upcoming date is available.
 */
export function computeDaysToEarnings(earningsDates: Date[]): number | null {
  if (!earningsDates || earningsDates.length === 0) return null;
  const now = Date.now();
  const upcoming = earningsDates
    .map((d) => d.getTime())
    .filter((t) => t > now)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return null;
  return Math.ceil((upcoming[0] - now) / (1000 * 60 * 60 * 24));
}

/**
 * Derive EPS revision direction from earningsTrend data.
 * Compares current estimate vs estimate from 30 days ago.
 * Returns true = revised up, false = revised down, null = no data.
 */
export function computeEpsRevision(earningsTrendRaw: any[]): boolean | null {
  if (!earningsTrendRaw || earningsTrendRaw.length === 0) return null;

  // Find the near-term trend period (0q = current quarter, 0y = current year)
  const nearTerm = earningsTrendRaw.find(
    (t: any) => t.period === '0q' || t.period === '0y'
  );
  if (!nearTerm) return null;

  const epsTrend = nearTerm.epsTrend;
  if (!epsTrend) return null;

  const current = typeof epsTrend.current === 'number' ? epsTrend.current : null;
  const thirtyDaysAgo = typeof epsTrend['30daysAgo'] === 'number' ? epsTrend['30daysAgo'] : null;

  if (current == null || thirtyDaysAgo == null || thirtyDaysAgo === 0) return null;
  return current > thirtyDaysAgo;
}
