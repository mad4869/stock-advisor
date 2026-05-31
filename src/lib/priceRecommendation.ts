/**
 * Price Action Recommendation Algorithm
 *
 * Generates entry price, stop loss, and take profit levels
 * using an ATR-based framework combined with existing TA data.
 *
 * Key approach:
 *   Entry  = nearest support cluster (EMA20, Pivot S1, BB lower, swing low)
 *   StopL  = Entry − (ATR × multiplier), cross-checked with structural support
 *   TakeP  = Entry + (Risk × R:R ratio), cross-checked with resistance
 *
 * All IDX prices are rounded to valid tick sizes.
 */

import { TAData } from './technicalIndicators';
import { Market } from '@/types';
import { roundToIDXTick } from './tickUtils';

// ─── Public Interface ────────────────────────────────────────────────

export interface PriceRecommendation {
  entryPrice: number;
  entryRationale: string;

  stopLoss: number;
  stopLossPercent: number;       // distance from entry as %
  stopLossRationale: string;

  takeProfitConservative: number; // 2:1 R:R
  takeProfitAggressive: number;   // 3:1 R:R
  takeProfitPercent: number;      // conservative TP distance as %

  riskRewardRatio: number;        // actual R:R at conservative TP
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;        // 0-100
  confidenceFactors: string[];

  atrValue: number;
  atrPercent: number;
}

// ─── Configuration ───────────────────────────────────────────────────

const ATR_SL_MULTIPLIER = 1.5;        // Standard swing stop: 1.5× ATR
const RR_CONSERVATIVE = 2;            // 2:1 risk-reward
const RR_AGGRESSIVE = 3;              // 3:1 risk-reward
const SUPPORT_CLUSTER_THRESHOLD = 0.02; // 2% proximity to group levels
const ENTRY_PULLBACK_MAX = 0.05;      // Entry must be within 5% of current price

// ─── Main Calculator ─────────────────────────────────────────────────

export function calculatePriceRecommendation(
  ta: TAData,
  historicalData: any[],
  market: Market
): PriceRecommendation | null {
  const price = ta.close;
  if (!price || price <= 0) return null;

  // We need ATR for stop-loss sizing
  const atrPercent = ta.atrPercent;
  if (atrPercent == null || atrPercent <= 0) return null;
  const atrValue = (atrPercent / 100) * price;

  // ─── 1. Gather Support Levels ─────────────────────────────────────

  const supportLevels: { price: number; label: string; weight: number }[] = [];

  if (ta.ema20 && ta.ema20 < price && ta.ema20 > 0) {
    supportLevels.push({ price: ta.ema20, label: 'EMA 20', weight: 3 });
  }
  if (ta.ema50 && ta.ema50 < price && ta.ema50 > 0) {
    supportLevels.push({ price: ta.ema50, label: 'EMA 50', weight: 2 });
  }
  if (ta.pivotS1 && ta.pivotS1 < price && ta.pivotS1 > 0) {
    supportLevels.push({ price: ta.pivotS1, label: 'Pivot S1', weight: 2 });
  }

  // Bollinger lower band
  if (ta.bollingerB != null) {
    // Reverse-engineer BB lower from %B: lower = (close - %B * bandwidth) ... 
    // Since we don't have raw BB values, estimate from close and %B:
    // %B = (close - lower) / (upper - lower)
    // If %B ∈ (0, 1), lower ≈ close - %B * (close * atrPercent/100 * 4)
    // This is a rough estimate; more precise if we recalculate.
    // Better approach: use BB lower ≈ close − 2σ. We can estimate σ from ATR:
    // ATR ≈ 1.2 × σ (empirical), so σ ≈ ATR / 1.2
    // BB lower ≈ SMA20 − 2σ ≈ EMA20 − 2 × (ATR / 1.2)
    if (ta.ema20) {
      const sigma = atrValue / 1.2;
      const bbLower = ta.ema20 - 2 * sigma;
      if (bbLower > 0 && bbLower < price) {
        supportLevels.push({ price: bbLower, label: 'BB Lower', weight: 1 });
      }
    }
  }

  // Swing low from historical data (lowest low in last 20 bars)
  const swingLow = findSwingLow(historicalData, 20);
  if (swingLow > 0 && swingLow < price) {
    supportLevels.push({ price: swingLow, label: 'Swing Low (20d)', weight: 2 });
  }

  // ─── 2. Gather Resistance Levels ──────────────────────────────────

  const resistanceLevels: { price: number; label: string; weight: number }[] = [];

  if (ta.pivotR1 && ta.pivotR1 > price && ta.pivotR1 > 0) {
    resistanceLevels.push({ price: ta.pivotR1, label: 'Pivot R1', weight: 2 });
  }
  if (ta.fiftyTwoWeekHigh && ta.fiftyTwoWeekHigh > price) {
    resistanceLevels.push({ price: ta.fiftyTwoWeekHigh, label: '52W High', weight: 1 });
  }
  if (ta.ema200 && ta.ema200 > price && ta.ema200 > 0) {
    resistanceLevels.push({ price: ta.ema200, label: 'EMA 200', weight: 2 });
  }
  // BB upper estimate
  if (ta.ema20) {
    const sigma = atrValue / 1.2;
    const bbUpper = ta.ema20 + 2 * sigma;
    if (bbUpper > price) {
      resistanceLevels.push({ price: bbUpper, label: 'BB Upper', weight: 1 });
    }
  }

  // ─── 3. Compute Entry Price ───────────────────────────────────────

  let entryPrice: number;
  let entryRationale: string;

  if (supportLevels.length === 0) {
    // No support levels below price — use current price minus small ATR fraction
    // as a minor pullback entry
    entryPrice = price - atrValue * 0.3;
    entryRationale = 'Minor pullback (0.3× ATR below current price)';
  } else {
    // Find the best support cluster near current price
    const cluster = findSupportCluster(supportLevels, price, SUPPORT_CLUSTER_THRESHOLD);

    if (cluster) {
      entryPrice = cluster.avgPrice;
      entryRationale = `Support cluster: ${cluster.labels.join(' + ')}`;
    } else {
      // Use the highest (nearest) support level
      const nearest = supportLevels
        .filter(s => (price - s.price) / price <= ENTRY_PULLBACK_MAX)
        .sort((a, b) => b.price - a.price)[0];

      if (nearest) {
        entryPrice = nearest.price;
        entryRationale = `${nearest.label} support`;
      } else {
        // All supports are too far; use current price with small pullback
        entryPrice = price - atrValue * 0.3;
        entryRationale = 'Minor pullback (supports distant)';
      }
    }
  }

  // If entry is too close to current price (within 0.2%), just use current price
  if (Math.abs(price - entryPrice) / price < 0.002) {
    entryPrice = price;
    entryRationale = 'At current price (near support)';
  }

  // ─── 4. Compute Stop Loss ─────────────────────────────────────────

  const atrStop = entryPrice - (ATR_SL_MULTIPLIER * atrValue);

  // Cross-check with structural support: swing low below entry
  const structuralStop = findSwingLow(historicalData, 30);
  let stopLoss: number;
  let stopLossRationale: string;

  if (structuralStop > 0 && structuralStop < entryPrice) {
    // Use the tighter of ATR stop or just below structural support
    const structuralStopAdjusted = structuralStop - atrValue * 0.2; // small buffer below swing low
    if (structuralStopAdjusted > atrStop && structuralStopAdjusted < entryPrice) {
      // Structural stop is tighter than ATR stop — prefer it (less risk)
      stopLoss = structuralStopAdjusted;
      stopLossRationale = `Below swing low (${structuralStop.toFixed(2)}) with buffer`;
    } else {
      stopLoss = atrStop;
      stopLossRationale = `${ATR_SL_MULTIPLIER}× ATR below entry`;
    }
  } else {
    stopLoss = atrStop;
    stopLossRationale = `${ATR_SL_MULTIPLIER}× ATR below entry`;
  }

  // Ensure stop loss is positive and below entry
  if (stopLoss <= 0) stopLoss = entryPrice * 0.9; // fallback: 10% below
  if (stopLoss >= entryPrice) stopLoss = entryPrice - atrValue;

  // ─── 5. Compute Take Profit ───────────────────────────────────────

  const risk = entryPrice - stopLoss;
  let tpConservative = entryPrice + risk * RR_CONSERVATIVE;
  let tpAggressive = entryPrice + risk * RR_AGGRESSIVE;

  // Cross-check with resistance: if TP is above nearest strong resistance,
  // note it but don't cap (user should be aware)
  // Find nearest resistance above entry
  const nearestResistance = resistanceLevels
    .filter(r => r.price > entryPrice)
    .sort((a, b) => a.price - b.price)[0];

  // ─── 6. Apply Market-Specific Rounding ─────────────────────────────

  if (market === 'ID') {
    entryPrice = roundToIDXTick(entryPrice);
    stopLoss = roundToIDXTick(stopLoss);
    tpConservative = roundToIDXTick(tpConservative);
    tpAggressive = roundToIDXTick(tpAggressive);
  } else {
    // US market: round to 2 decimal places
    entryPrice = Math.round(entryPrice * 100) / 100;
    stopLoss = Math.round(stopLoss * 100) / 100;
    tpConservative = Math.round(tpConservative * 100) / 100;
    tpAggressive = Math.round(tpAggressive * 100) / 100;
  }

  // ─── 7. Compute Metrics ────────────────────────────────────────────

  const stopLossPercent = entryPrice > 0
    ? ((entryPrice - stopLoss) / entryPrice) * 100
    : 0;
  const takeProfitPercent = entryPrice > 0
    ? ((tpConservative - entryPrice) / entryPrice) * 100
    : 0;
  const riskRewardRatio = stopLossPercent > 0
    ? takeProfitPercent / stopLossPercent
    : 0;

  // ─── 8. Compute Confidence ─────────────────────────────────────────

  const { score, level, factors } = computeConfidence(
    ta, supportLevels, resistanceLevels, entryPrice, tpConservative, nearestResistance
  );

  return {
    entryPrice,
    entryRationale,
    stopLoss,
    stopLossPercent: Math.round(stopLossPercent * 100) / 100,
    stopLossRationale,
    takeProfitConservative: tpConservative,
    takeProfitAggressive: tpAggressive,
    takeProfitPercent: Math.round(takeProfitPercent * 100) / 100,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    confidence: level,
    confidenceScore: score,
    confidenceFactors: factors,
    atrValue: Math.round(atrValue * 100) / 100,
    atrPercent: Math.round(atrPercent * 100) / 100,
  };
}

// ─── Support Utilities ───────────────────────────────────────────────

/**
 * Find the lowest low in the last `lookback` bars of historical data.
 */
function findSwingLow(historicalData: any[], lookback: number): number {
  if (!historicalData || historicalData.length < lookback) {
    return 0;
  }

  const recentBars = historicalData.slice(-lookback);
  let lowest = Infinity;

  for (const bar of recentBars) {
    const low = bar.low;
    if (low != null && low > 0 && low < lowest) {
      lowest = low;
    }
  }

  return lowest === Infinity ? 0 : lowest;
}

/**
 * Groups nearby support levels into clusters and returns the strongest one
 * (most levels converging) that is close to the current price.
 */
function findSupportCluster(
  levels: { price: number; label: string; weight: number }[],
  currentPrice: number,
  threshold: number
): { avgPrice: number; labels: string[]; totalWeight: number } | null {
  if (levels.length < 2) return null;

  // Sort by price descending (nearest to current price first)
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  const clusters: { prices: number[]; labels: string[]; totalWeight: number }[] = [];

  for (const level of sorted) {
    let added = false;
    for (const cluster of clusters) {
      const clusterAvg = cluster.prices.reduce((s, p) => s + p, 0) / cluster.prices.length;
      if (Math.abs(level.price - clusterAvg) / clusterAvg <= threshold) {
        cluster.prices.push(level.price);
        cluster.labels.push(level.label);
        cluster.totalWeight += level.weight;
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({
        prices: [level.price],
        labels: [level.label],
        totalWeight: level.weight,
      });
    }
  }

  // Only consider clusters with 2+ levels (true convergence)
  const multiClusters = clusters.filter(c => c.prices.length >= 2);
  if (multiClusters.length === 0) return null;

  // Pick the cluster with the highest total weight
  const best = multiClusters.sort((a, b) => b.totalWeight - a.totalWeight)[0];
  const avgPrice = best.prices.reduce((s, p) => s + p, 0) / best.prices.length;

  // Only return if within the max pullback distance from current price
  if ((currentPrice - avgPrice) / currentPrice > ENTRY_PULLBACK_MAX) return null;

  return {
    avgPrice,
    labels: best.labels,
    totalWeight: best.totalWeight,
  };
}

/**
 * Compute confidence score (0-100) based on multiple factors.
 */
function computeConfidence(
  ta: TAData,
  supportLevels: { price: number; label: string; weight: number }[],
  resistanceLevels: { price: number; label: string; weight: number }[],
  entryPrice: number,
  tpConservative: number,
  nearestResistance: { price: number; label: string; weight: number } | undefined
): { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW'; factors: string[] } {
  let score = 50; // base score
  const factors: string[] = [];

  // ── Trend Alignment (+/- 15) ──
  const trendBullish =
    (ta.ema20 != null && ta.close > ta.ema20) &&
    (ta.ema50 != null && ta.ema20! > ta.ema50);

  if (trendBullish) {
    score += 15;
    factors.push('Trend aligned (EMA stack bullish)');
  } else if (ta.ema20 != null && ta.close < ta.ema20) {
    score -= 15;
    factors.push('Price below EMA 20 (trend caution)');
  }

  // ── Supertrend Confirmation (+/- 10) ──
  if (ta.supertrendBullish === true) {
    score += 10;
    factors.push('Supertrend confirms uptrend');
  } else if (ta.supertrendBullish === false) {
    score -= 10;
    factors.push('Supertrend bearish');
  }

  // ── Support Convergence (+5 per level, max +15) ──
  const convergenceBonus = Math.min(supportLevels.length * 5, 15);
  if (convergenceBonus > 0) {
    score += convergenceBonus;
    factors.push(`${supportLevels.length} support level${supportLevels.length > 1 ? 's' : ''} identified`);
  }

  // ── Resistance Check (-10 if TP beyond nearest resistance) ──
  if (nearestResistance && tpConservative > nearestResistance.price) {
    score -= 10;
    factors.push(`Conservative TP above ${nearestResistance.label} resistance`);
  }

  // ── Volume Confirmation (+10) ──
  if (ta.obvTrendPositive && ta.volumeRatio != null && ta.volumeRatio >= 1.2) {
    score += 10;
    factors.push('Volume confirms buying pressure');
  }

  // ── RSI Zone (+/- 5) ──
  if (ta.rsi != null) {
    if (ta.rsi >= 40 && ta.rsi <= 65) {
      score += 5;
      factors.push('RSI in healthy zone');
    } else if (ta.rsi > 75) {
      score -= 5;
      factors.push('RSI overbought (elevated risk)');
    }
  }

  // ── Volatility Penalty ──
  if (ta.atrPercent != null && ta.atrPercent > 6) {
    score -= 10;
    factors.push('High volatility (wider stops needed)');
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  let level: 'HIGH' | 'MEDIUM' | 'LOW';
  if (score >= 70) level = 'HIGH';
  else if (score >= 45) level = 'MEDIUM';
  else level = 'LOW';

  return { score, level, factors };
}
