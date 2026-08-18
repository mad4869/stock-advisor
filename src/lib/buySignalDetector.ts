/**
 * BUY Signal Detector
 *
 * Detects high-conviction BUY opportunities by scoring stocks across three
 * convergence categories:
 *   1. Near Support — price sitting at technical support levels
 *   2. Oversold / Momentum Reversal — momentum indicators signalling a bounce
 *   3. Value / Deep Discount — price near historic lows with accumulation evidence
 *
 * A BUY signal fires when enough evidence converges from multiple categories
 * AND the stock passes a fundamental quality gate.
 *
 * Returns actionable trade parameters: entry prices, stop loss, and targets.
 */

import { TAData } from './technicalIndicators';
import { Market } from '@/types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface BuySignalReason {
  category: 'support' | 'oversold' | 'value' | 'breakout';
  label: string;
  detail: string;
}

export interface PriceLevel {
  price: number;
  label: string;
}

export interface FundamentalSummary {
  grade: string;
  total: number;
  roe: string | null;
  debtToEquity: string | null;
  dividendYield: string | null;
}

export interface BuySignalResult {
  isBuy: boolean;
  reasons: BuySignalReason[];
  supportSignals: number;
  oversoldSignals: number;
  valueSignals: number;
  breakoutSignals: number;
  entries: PriceLevel[];
  stopLoss: PriceLevel | null;
  targets: PriceLevel[];
  fundamentalSummary: FundamentalSummary | null;
}

export interface FundamentalInput {
  grade?: string | null;
  total?: number | null;
  roe?: number | null;
  debtToEquity?: number | null;
  dividendYield?: number | null;
  analystUpside?: number | null;
  analystConsensus?: string | null;
  analystTargetPrice?: number | null;
}

// ─────────────────────────────────────────────────────────────
// Detector
// ─────────────────────────────────────────────────────────────

export function detectBuySignal(
  ta: TAData,
  market: Market,
  fundamentals?: FundamentalInput | null
): BuySignalResult {
  const reasons: BuySignalReason[] = [];
  const price = ta.close;
  const cur = market === 'ID' ? 'Rp' : '$';
  const fmtP = (v: number) =>
    market === 'ID' ? v.toLocaleString('id-ID') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── CATEGORY 1: Near Support ──────────────────────────────

  let supportSignals = 0;

  // 1a. Near Lower Bollinger Band — must be really pinned to the band
  if (ta.bollingerB != null && ta.bollingerB < 0.10) {
    supportSignals++;
    reasons.push({
      category: 'support',
      label: 'Near Lower Bollinger Band',
      detail: `%B: ${ta.bollingerB.toFixed(2)}`
    });
  }

  // 1b. Near EMA50
  if (ta.distFromEMA50 != null && ta.distFromEMA50 >= -0.03 && ta.distFromEMA50 <= 0.01) {
    supportSignals++;
    reasons.push({
      category: 'support',
      label: 'Near EMA50 Support',
      detail: `${(ta.distFromEMA50 * 100).toFixed(1)}% away`
    });
  }

  // 1c. Near EMA200
  if (ta.distFromEMA200 != null && ta.distFromEMA200 >= -0.03 && ta.distFromEMA200 <= 0.01) {
    supportSignals++;
    reasons.push({
      category: 'support',
      label: 'Near EMA200 Support',
      detail: `${(ta.distFromEMA200 * 100).toFixed(1)}% away`
    });
  }

  // 1d. Near Pivot S1
  if (ta.distanceToS1 != null && ta.distanceToS1 >= 0 && ta.distanceToS1 <= 0.03) {
    supportSignals++;
    reasons.push({
      category: 'support',
      label: 'Near Pivot S1',
      detail: `${(ta.distanceToS1 * 100).toFixed(1)}% from S1 (${cur}${ta.pivotS1 ? fmtP(ta.pivotS1) : '—'})`
    });
  }

  // 1e. Near Fibonacci Support Level
  if (ta.fibonacciLevels) {
    const fib = ta.fibonacciLevels;
    const fibLevels = [
      { level: fib.fib382, label: 'Fib 38.2%' },
      { level: fib.fib500, label: 'Fib 50%' },
      { level: fib.fib618, label: 'Fib 61.8%' },
    ];
    for (const fl of fibLevels) {
      if (fl.level > 0) {
        const dist = Math.abs(price - fl.level) / fl.level;
        if (dist <= 0.02) {
          supportSignals++;
          reasons.push({
            category: 'support',
            label: `Near ${fl.label} Support`,
            detail: `${cur}${fmtP(fl.level)} (${(dist * 100).toFixed(1)}% away)`
          });
          break; // only count the nearest fib level
        }
      }
    }
  }

  // 1f. Supertrend Bullish Flip
  if (ta.supertrendBullish === true && ta.psar != null && ta.psar < price) {
    supportSignals++;
    reasons.push({
      category: 'support',
      label: 'Supertrend Bullish',
      detail: `PSAR at ${cur}${fmtP(ta.psar)}`
    });
  }

  // ── CATEGORY 2: Oversold / Momentum Reversal ──────────────

  let oversoldSignals = 0;

  // 2a. RSI Oversold — strict threshold
  if (ta.rsi != null && ta.rsi < 32) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'RSI Oversold',
      detail: `RSI: ${ta.rsi.toFixed(1)}`
    });
  }

  // 2b. Stochastic Recovery
  if (ta.stochRecovery) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'Stochastic Recovery',
      detail: `K crossed above D from below 20`
    });
  }

  // 2c. MFI Oversold
  if (ta.mfi != null && ta.mfi < 25) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'MFI Oversold',
      detail: `MFI: ${ta.mfi.toFixed(1)}`
    });
  }

  // 2d. Williams %R Oversold
  if (ta.williamsR != null && ta.williamsR < -80) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'Williams %R Oversold',
      detail: `%R: ${ta.williamsR.toFixed(1)}`
    });
  }

  // 2e. CCI Oversold
  if (ta.cci != null && ta.cci < -100) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'CCI Oversold',
      detail: `CCI: ${ta.cci.toFixed(1)}`
    });
  }

  // 2f. MACD Golden Cross from below zero
  if (ta.macdCrossFromBelowZero) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'MACD Golden Cross',
      detail: `MACD crossed signal from below zero`
    });
  }

  // 2g. RSI Bullish Divergence
  if (ta.rsiDivergence) {
    oversoldSignals++;
    reasons.push({
      category: 'oversold',
      label: 'RSI Bullish Divergence',
      detail: `Price lower low, RSI higher low`
    });
  }

  // ── CATEGORY 3: Value / Deep Discount ─────────────────────

  let valueSignals = 0;

  // 3a. Near 52-Week Low — tighter proximity
  if (ta.fiftyTwoWeekLow != null && ta.fiftyTwoWeekLow > 0) {
    const distTo52wLow = (price - ta.fiftyTwoWeekLow) / ta.fiftyTwoWeekLow;
    if (distTo52wLow <= 0.10 && distTo52wLow >= 0) {
      valueSignals++;
      reasons.push({
        category: 'value',
        label: 'Near 52-Week Low',
        detail: `${(distTo52wLow * 100).toFixed(1)}% above 52W low (${cur}${fmtP(ta.fiftyTwoWeekLow)})`
      });
    }
  }

  // 3b. OBV Trend Positive (accumulation despite price dip)
  if (ta.obvTrendPositive) {
    valueSignals++;
    reasons.push({
      category: 'value',
      label: 'OBV Accumulation',
      detail: `Volume accumulation detected`
    });
  }

  // 3c. Analyst Upside ≥ 20%
  if (fundamentals?.analystUpside != null && fundamentals.analystUpside >= 20) {
    valueSignals++;
    reasons.push({
      category: 'value',
      label: 'Analyst Upside',
      detail: `+${fundamentals.analystUpside.toFixed(0)}% upside to target`
    });
  }

  // ── CATEGORY 4: Breakout / Trend Reversal ─────────────────

  let breakoutSignals = 0;

  // 4a. Golden Cross: EMA50 crossed above EMA200 within last 10 bars
  if (ta.goldenCross) {
    breakoutSignals++;
    const daysAgo = ta.ema50CrossedAboveEma200DaysAgo;
    reasons.push({
      category: 'breakout',
      label: 'Golden Cross',
      detail: daysAgo === 0
        ? 'EMA50 crossed above EMA200 today'
        : `EMA50 crossed EMA200 ${daysAgo} bar${daysAgo !== 1 ? 's' : ''} ago`
    });
  }

  // 4b. Price Reclaimed EMA200: crossed back above from below within last 5 bars
  if (ta.priceReclaimedEma200) {
    breakoutSignals++;
    reasons.push({
      category: 'breakout',
      label: 'Reclaimed EMA200',
      detail: `Price crossed above EMA200 — regime change signal`
    });
  }

  // 4c. 52-Week High Breakout — only for grade A/B stocks (momentum setup)
  if (ta.breakoutAbove52wHigh && fundamentals?.grade && ['A', 'B'].includes(fundamentals.grade)) {
    breakoutSignals++;
    reasons.push({
      category: 'breakout',
      label: '52W High Breakout',
      detail: `Price at/above 52W high — breakout territory`
    });
  }

  // 4d. Volume Breakout: up-day on 2×+ average volume
  if (ta.volumeBreakout) {
    breakoutSignals++;
    const volStr = ta.volumeRatio != null ? `${ta.volumeRatio.toFixed(1)}× avg volume` : 'above avg volume';
    reasons.push({
      category: 'breakout',
      label: 'Volume Breakout',
      detail: `Up-day on ${volStr}`
    });
  }

  // 4e. Bollinger Band Breakout: %B > 0.90
  if (ta.bollingerBreakout) {
    breakoutSignals++;
    reasons.push({
      category: 'breakout',
      label: 'Bollinger Breakout',
      detail: `%B: ${ta.bollingerB?.toFixed(2)} — expanding above upper band`
    });
  }

  // 4f. Strong trend confirmed by ADX (ADX > 25, +DI > -DI)
  if (ta.adxTrendStrong) {
    breakoutSignals++;
    reasons.push({
      category: 'breakout',
      label: 'Strong ADX Trend',
      detail: `ADX: ${ta.adx?.toFixed(1)} (${ta.plusDi?.toFixed(1)} +DI > ${ta.minusDi?.toFixed(1)} -DI)`
    });
  }

  // ── FUNDAMENTAL QUALITY GATE ──────────────────────────────

  const fundGrade = fundamentals?.grade ?? null;
  const passingGrades = ['A', 'B', 'C'];
  const strongGrades = ['A', 'B'];

  // Fundamental gate: must be grade A/B/C, or if no grade available, ROE > 0 as fallback
  let fundamentalPass = false;
  if (fundGrade && passingGrades.includes(fundGrade)) {
    fundamentalPass = true;
  } else if (!fundGrade && fundamentals?.roe != null && fundamentals.roe > 0) {
    fundamentalPass = true;
  }

  // ── BUY SIGNAL TRIGGER RULE ───────────────────────────────

  let isBuy = false;

  // Track whether any "confirmation" quality signals are present
  // (these are the less co-moving, more independent signals)
  const hasRsiDivergence = reasons.some(r => r.label === 'RSI Bullish Divergence');
  const hasMacdGC = reasons.some(r => r.label === 'MACD Golden Cross');
  const hasStochRecovery = reasons.some(r => r.label === 'Stochastic Recovery');
  const hasHighQualityOversold = hasRsiDivergence || hasMacdGC || hasStochRecovery;

  if (fundamentalPass) {
    // Rule 1: ≥3 support + ≥2 oversold — strong convergence required
    if (supportSignals >= 3 && oversoldSignals >= 2) {
      isBuy = true;
    }
    // Rule 1b: ≥2 support + ≥2 oversold, but at least one oversold must be a quality signal
    if (supportSignals >= 2 && oversoldSignals >= 2 && hasHighQualityOversold) {
      isBuy = true;
    }
    // Rule 2: ≥4 oversold alone, but must include at least one quality (non-co-moving) signal
    if (oversoldSignals >= 4 && hasHighQualityOversold) {
      isBuy = true;
    }
    // Rule 3: near 52W low + ≥2 oversold + grade A only (very strong value play)
    const has52wLow = reasons.some(r => r.label === 'Near 52-Week Low');
    if (has52wLow && oversoldSignals >= 2 && fundGrade === 'A') {
      isBuy = true;
    }
    // Rule 4: Breakout — requires ≥2 breakout signals + grade A/B
    // This catches momentum/trend reversal entries that the mean-reversion rules would miss.
    // Must include at least one structural signal (Golden Cross, Reclaimed EMA200, 52W Breakout)
    // plus at least one confirmation (Volume or Bollinger or ADX).
    const hasStructuralBreakout = reasons.some(r =>
      r.label === 'Golden Cross' || r.label === 'Reclaimed EMA200' || r.label === '52W High Breakout'
    );
    const hasBreakoutConfirmation = reasons.some(r =>
      r.label === 'Volume Breakout' || r.label === 'Bollinger Breakout' || r.label === 'Strong ADX Trend'
    );
    if (
      breakoutSignals >= 2 &&
      hasStructuralBreakout &&
      hasBreakoutConfirmation &&
      fundGrade != null &&
      strongGrades.includes(fundGrade)
    ) {
      isBuy = true;
    }
  }

  // ── PRICE LEVELS: Entry, Stop Loss, Targets ───────────────

  const entries: PriceLevel[] = [];
  const targets: PriceLevel[] = [];
  let stopLoss: PriceLevel | null = null;

  if (isBuy) {
    // Entry 1: Aggressive — current price
    entries.push({ price, label: 'Aggressive (Current Price)' });

    // Entry 2: Conservative — nearest support below
    const supportLevels: number[] = [];
    if (ta.pivotS1 != null && ta.pivotS1 < price && ta.pivotS1 > price * 0.95) {
      supportLevels.push(ta.pivotS1);
    }
    if (ta.ema200 != null && ta.ema200 < price && ta.ema200 > price * 0.95) {
      supportLevels.push(ta.ema200);
    }
    if (ta.fibonacciLevels) {
      const fibBelow = [ta.fibonacciLevels.fib618, ta.fibonacciLevels.fib500, ta.fibonacciLevels.fib382]
        .filter(f => f > 0 && f < price && f > price * 0.95);
      supportLevels.push(...fibBelow);
    }

    if (supportLevels.length > 0) {
      const conservativeEntry = Math.min(...supportLevels);
      const distPct = ((price - conservativeEntry) / price) * 100;
      if (distPct >= 1 && distPct <= 5) {
        // Determine the label based on which level matched
        let entryLabel = 'Conservative (Support)';
        if (ta.pivotS1 != null && conservativeEntry === ta.pivotS1) entryLabel = 'Conservative (Pivot S1)';
        else if (ta.ema200 != null && conservativeEntry === ta.ema200) entryLabel = 'Conservative (EMA200)';
        else entryLabel = 'Conservative (Fibonacci)';
        entries.push({ price: conservativeEntry, label: entryLabel });
      }
    }

    // Stop Loss: ATR-based (2× ATR below current price)
    if (ta.atrPercent != null && ta.atrPercent > 0) {
      const atrAbsolute = price * (ta.atrPercent / 100);
      const slPrice = price - 2 * atrAbsolute;
      stopLoss = { price: Math.max(0, slPrice), label: `2× ATR (${ta.atrPercent.toFixed(1)}%)` };
    } else {
      // Fallback: 5% below current price
      stopLoss = { price: price * 0.95, label: '5% below entry' };
    }

    // Target 1: Conservative — first resistance above
    const resistanceLevels: { price: number; label: string }[] = [];
    if (ta.pivotR1 != null && ta.pivotR1 > price) {
      resistanceLevels.push({ price: ta.pivotR1, label: 'Pivot R1' });
    }
    if (ta.ema50 != null && ta.ema50 > price) {
      resistanceLevels.push({ price: ta.ema50, label: 'EMA50' });
    }
    if (ta.sma50 != null && ta.sma50 > price) {
      resistanceLevels.push({ price: ta.sma50, label: 'SMA50' });
    }
    if (ta.fibonacciLevels) {
      const fibAbove = [
        { p: ta.fibonacciLevels.fib382, l: 'Fib 38.2%' },
        { p: ta.fibonacciLevels.fib236, l: 'Fib 23.6%' },
      ].filter(f => f.p > price);
      for (const fa of fibAbove) {
        resistanceLevels.push({ price: fa.p, label: fa.l });
      }
    }

    if (resistanceLevels.length > 0) {
      resistanceLevels.sort((a, b) => a.price - b.price);
      const t1 = resistanceLevels[0];
      const upside1 = ((t1.price - price) / price) * 100;
      targets.push({ price: t1.price, label: `${t1.label} (+${upside1.toFixed(1)}%)` });
    }

    // Target 2: Optimistic — higher target
    const optimisticCandidates: { price: number; label: string }[] = [];
    if (ta.fiftyTwoWeekHigh != null && ta.fiftyTwoWeekHigh > price) {
      optimisticCandidates.push({ price: ta.fiftyTwoWeekHigh * 0.95, label: '95% of 52W High' });
    }
    if (fundamentals?.analystTargetPrice != null && fundamentals.analystTargetPrice > price) {
      optimisticCandidates.push({ price: fundamentals.analystTargetPrice, label: 'Analyst Target' });
    }

    if (optimisticCandidates.length > 0) {
      // Pick the higher of the two for T2
      optimisticCandidates.sort((a, b) => b.price - a.price);
      const t2 = optimisticCandidates[0];
      // Only add if meaningfully different from T1
      const existingT1 = targets.length > 0 ? targets[0].price : 0;
      if (t2.price > existingT1 * 1.03) {
        const upside2 = ((t2.price - price) / price) * 100;
        targets.push({ price: t2.price, label: `${t2.label} (+${upside2.toFixed(1)}%)` });
      }
    }
  }

  // ── FUNDAMENTAL SUMMARY ───────────────────────────────────

  let fundamentalSummary: FundamentalSummary | null = null;
  if (fundamentals) {
    fundamentalSummary = {
      grade: fundamentals.grade ?? '—',
      total: fundamentals.total ?? 0,
      roe: fundamentals.roe != null ? `${fundamentals.roe.toFixed(1)}%` : null,
      debtToEquity: fundamentals.debtToEquity != null ? `${fundamentals.debtToEquity.toFixed(2)}x` : null,
      dividendYield: fundamentals.dividendYield != null ? `${fundamentals.dividendYield.toFixed(1)}%` : null,
    };
  }

  return {
    isBuy,
    reasons,
    supportSignals,
    oversoldSignals,
    valueSignals,
    breakoutSignals,
    entries,
    stopLoss,
    targets,
    fundamentalSummary,
  };
}
