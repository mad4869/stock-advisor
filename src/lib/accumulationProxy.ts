/**
 * Accumulation Proxy — Volume-based Smart Money Detection
 *
 * Computes smart money accumulation signals entirely from OHLCV data.
 * This replaces the old bandarmology.ts module which relied on Yahoo Finance
 * quoteSummary data (empty for IDX stocks).
 *
 * Signals:
 *   1. A/D Line trend — Accumulation/Distribution line slope
 *   2. CMF — Chaikin Money Flow (20-period)
 *   3. Volume Profile — Up-day vs down-day volume ratio
 *   4. OBV Divergence — OBV rising while price flat/falling
 *   5. Large Block Detection — High-volume up-days (institutional footprint)
 */

export interface AccumulationSignals {
  // Individual signals
  adTrendBullish: boolean;       // A/D line trending up (5-period slope)
  cmf: number;                   // Chaikin Money Flow value (-1 to 1)
  cmfBullish: boolean;           // CMF > 0
  volumeProfileBullish: boolean; // Up-day volume > down-day volume (20-day)
  obvDivergence: boolean;        // OBV rising while price flat/down
  largeBlockBuying: boolean;     // Recent high-volume up-days detected

  // Composite
  accumulationScore: number;     // 0-100 composite score
  isAccumulating: boolean;       // Score >= threshold (40)
  signalCount: number;           // How many signals are bullish
  totalSignals: number;          // Always 5
  logs: string[];                // Human-readable log per signal
}

// Minimum data points needed to compute all signals
const MIN_DATA_POINTS = 30;

/**
 * Compute Money Flow Multiplier for a single bar.
 * MFM = ((Close - Low) - (High - Close)) / (High - Low)
 * Range: -1 to +1. Close at high = +1, close at low = -1.
 */
function moneyFlowMultiplier(high: number, low: number, close: number): number {
  const range = high - low;
  if (range === 0) return 0;
  return ((close - low) - (high - close)) / range;
}

/**
 * Compute Accumulation/Distribution Line from OHLCV data.
 * A/D[i] = A/D[i-1] + MFM[i] * Volume[i]
 */
function computeADLine(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  const adLine: number[] = [];
  let cumAD = 0;

  for (let i = 0; i < closes.length; i++) {
    const mfm = moneyFlowMultiplier(highs[i], lows[i], closes[i]);
    const mfv = mfm * volumes[i]; // Money Flow Volume
    cumAD += mfv;
    adLine.push(cumAD);
  }

  return adLine;
}

/**
 * Check if A/D line is trending up over the last `period` bars.
 * Uses simple linear regression slope.
 */
function isADTrendBullish(adLine: number[], period: number = 5): boolean {
  if (adLine.length < period) return false;

  const slice = adLine.slice(-period);
  // Simple slope: compare average of first half vs second half
  const mid = Math.floor(period / 2);
  const firstHalf = slice.slice(0, mid);
  const secondHalf = slice.slice(mid);

  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  return avgSecond > avgFirst;
}

/**
 * Compute Chaikin Money Flow (CMF) over the given period.
 * CMF = Sum(MFV, period) / Sum(Volume, period)
 */
function computeCMF(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 20
): number {
  if (closes.length < period) return 0;

  let sumMFV = 0;
  let sumVol = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const mfm = moneyFlowMultiplier(highs[i], lows[i], closes[i]);
    sumMFV += mfm * volumes[i];
    sumVol += volumes[i];
  }

  return sumVol === 0 ? 0 : sumMFV / sumVol;
}

/**
 * Volume Profile: Ratio of average up-day volume to average down-day volume.
 * Returns the ratio (>1 = more volume on up-days) and whether it's bullish.
 */
function computeVolumeProfile(
  closes: number[],
  volumes: number[],
  period: number = 20
): { ratio: number; bullish: boolean } {
  if (closes.length < period + 1) return { ratio: 1, bullish: false };

  let upVolume = 0;
  let downVolume = 0;
  let upDays = 0;
  let downDays = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      upVolume += volumes[i];
      upDays++;
    } else if (closes[i] < closes[i - 1]) {
      downVolume += volumes[i];
      downDays++;
    }
    // Flat days are ignored
  }

  const avgUp = upDays > 0 ? upVolume / upDays : 0;
  const avgDown = downDays > 0 ? downVolume / downDays : 0;
  const ratio = avgDown > 0 ? avgUp / avgDown : (avgUp > 0 ? 2 : 1);

  return {
    ratio: Math.round(ratio * 100) / 100,
    bullish: ratio > 1.2
  };
}

/**
 * OBV Divergence Detection.
 * Bullish divergence: OBV trending up while price is flat or down.
 * Looks at the last `period` bars.
 */
function detectOBVDivergence(
  closes: number[],
  volumes: number[],
  period: number = 10
): boolean {
  if (closes.length < period) return false;

  // Compute OBV
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv.push(obv[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obv.push(obv[i - 1] - volumes[i]);
    } else {
      obv.push(obv[i - 1]);
    }
  }

  // Check last `period` bars
  const priceSlice = closes.slice(-period);
  const obvSlice = obv.slice(-period);

  // Price direction: compare first third vs last third
  const third = Math.floor(period / 3);
  const priceStart = priceSlice.slice(0, third).reduce((s, v) => s + v, 0) / third;
  const priceEnd = priceSlice.slice(-third).reduce((s, v) => s + v, 0) / third;
  const priceChange = (priceEnd - priceStart) / priceStart;

  const obvStart = obvSlice.slice(0, third).reduce((s, v) => s + v, 0) / third;
  const obvEnd = obvSlice.slice(-third).reduce((s, v) => s + v, 0) / third;

  // Bullish divergence: price flat/down (< +2%) AND OBV rising
  const priceFlatOrDown = priceChange < 0.02;
  const obvRising = obvEnd > obvStart;

  return priceFlatOrDown && obvRising;
}

/**
 * Large Block Detection.
 * Counts days in the last `lookback` period where:
 *   - Volume > 3× the 20-day average
 *   - Close > Open (up-day)
 * If count >= `threshold`, it indicates institutional buying.
 */
function detectLargeBlocks(
  closes: number[],
  opens: number[],
  volumes: number[],
  lookback: number = 10,
  threshold: number = 2
): { detected: boolean; count: number } {
  if (closes.length < 20 + lookback) return { detected: false, count: 0 };

  // Compute 20-day average volume ending before the lookback period
  const avgVolEnd = closes.length - lookback;
  const avgVolStart = Math.max(0, avgVolEnd - 20);
  const volSlice = volumes.slice(avgVolStart, avgVolEnd);
  const avgVol = volSlice.reduce((s, v) => s + v, 0) / volSlice.length;

  if (avgVol === 0) return { detected: false, count: 0 };

  let largeUpDays = 0;
  for (let i = closes.length - lookback; i < closes.length; i++) {
    const isUpDay = closes[i] > opens[i];
    const isLargeVol = volumes[i] > avgVol * 3;
    if (isUpDay && isLargeVol) largeUpDays++;
  }

  return {
    detected: largeUpDays >= threshold,
    count: largeUpDays
  };
}

/**
 * Main entry point: compute all accumulation signals from OHLCV history.
 *
 * @param history - Array of OHLCV bars (oldest to newest), each with
 *                  { open, high, low, close, volume }
 * @param threshold - Minimum accumulationScore to pass (default: 40 = 2/5 signals)
 * @returns AccumulationSignals
 */
export function computeAccumulation(
  history: Array<{ open: number; high: number; low: number; close: number; volume: number }>,
  threshold: number = 40
): AccumulationSignals {
  const logs: string[] = [];

  // Default fallback for insufficient data
  const defaultResult: AccumulationSignals = {
    adTrendBullish: false,
    cmf: 0,
    cmfBullish: false,
    volumeProfileBullish: false,
    obvDivergence: false,
    largeBlockBuying: false,
    accumulationScore: 0,
    isAccumulating: false,
    signalCount: 0,
    totalSignals: 5,
    logs: ['Insufficient data for accumulation analysis']
  };

  // Filter out bars with null/zero values that would corrupt calculations
  const validHistory = history.filter(
    h => h.open != null && h.open > 0 &&
         h.high != null && h.high > 0 &&
         h.low != null && h.low > 0 &&
         h.close != null && h.close > 0 &&
         h.volume != null && h.volume >= 0
  );

  if (validHistory.length < MIN_DATA_POINTS) {
    return defaultResult;
  }

  // Extract arrays from validated data
  const opens = validHistory.map(h => h.open);
  const highs = validHistory.map(h => h.high);
  const lows = validHistory.map(h => h.low);
  const closes = validHistory.map(h => h.close);
  const volumes = validHistory.map(h => h.volume);

  // 1. A/D Line Trend
  const adLine = computeADLine(highs, lows, closes, volumes);
  const adBullish = isADTrendBullish(adLine, 5);
  logs.push(`A/D Line: ${adBullish ? 'Passed' : 'Failed'} (5-period trend ${adBullish ? 'rising' : 'falling'})`);

  // 2. Chaikin Money Flow
  const cmf = computeCMF(highs, lows, closes, volumes, 20);
  const cmfBullish = cmf > 0;
  logs.push(`CMF (20): ${cmfBullish ? 'Passed' : 'Failed'} (Value: ${cmf.toFixed(4)})`);

  // 3. Volume Profile
  const volProfile = computeVolumeProfile(closes, volumes, 20);
  logs.push(`Volume Profile: ${volProfile.bullish ? 'Passed' : 'Failed'} (Up/Down Ratio: ${volProfile.ratio}x)`);

  // 4. OBV Divergence
  const obvDiv = detectOBVDivergence(closes, volumes, 10);
  logs.push(`OBV Divergence: ${obvDiv ? 'Passed' : 'Failed'} (${obvDiv ? 'Bullish divergence detected' : 'No divergence'})`);

  // 5. Large Block Detection
  const blocks = detectLargeBlocks(closes, opens, volumes, 10, 2);
  logs.push(`Large Blocks: ${blocks.detected ? 'Passed' : 'Failed'} (${blocks.count} large up-day${blocks.count !== 1 ? 's' : ''} in last 10 sessions)`);

  // Composite score
  const signals = [adBullish, cmfBullish, volProfile.bullish, obvDiv, blocks.detected];
  const signalCount = signals.filter(Boolean).length;
  const accumulationScore = signalCount * 20; // Each signal = 20 points, max 100

  const isAccumulating = accumulationScore >= threshold;
  logs.push(`Smart Money: ${isAccumulating ? 'ACCUMULATING' : 'NOT ACCUMULATING'} (Score: ${accumulationScore}/100, ${signalCount}/5 signals)`);

  return {
    adTrendBullish: adBullish,
    cmf,
    cmfBullish,
    volumeProfileBullish: volProfile.bullish,
    obvDivergence: obvDiv,
    largeBlockBuying: blocks.detected,
    accumulationScore,
    isAccumulating,
    signalCount,
    totalSignals: 5,
    logs
  };
}

/**
 * Multi-Timeframe Accumulation Consistency.
 * Runs the same 5 signals independently on short (5d suffix), medium (10d), and long (20d) windows.
 * Each window uses the most recent N bars as context.
 * Returns a score per window (0–100) and a human-readable label.
 */
export function computeAccumulationMultiTimeframe(
  history: Array<{ open: number; high: number; low: number; close: number; volume: number }>
): { s: number; m: number; l: number; label: string } {
  const validHistory = history.filter(
    h => h.open > 0 && h.high > 0 && h.low > 0 && h.close > 0 && h.volume >= 0
  );

  function scoreWindow(n: number): number {
    if (validHistory.length < n + 5) return 0;
    const slice = validHistory.slice(-n);
    const opens  = slice.map(h => h.open);
    const highs  = slice.map(h => h.high);
    const lows   = slice.map(h => h.low);
    const closes = slice.map(h => h.close);
    const vols   = slice.map(h => h.volume);

    const adLine  = (() => {
      let cum = 0;
      return closes.map((_, i) => { cum += moneyFlowMultiplier(highs[i], lows[i], closes[i]) * vols[i]; return cum; });
    })();
    const period  = Math.min(n, 5);
    const adOk    = isADTrendBullish(adLine, period);
    const cmfPer  = Math.min(n, 10);
    const cmfVal  = computeCMF(highs, lows, closes, vols, cmfPer);
    const cmfOk   = cmfVal > 0;
    const vpPer   = Math.min(n, 10);
    const vpRes   = computeVolumeProfile(closes, vols, vpPer);
    const vpOk    = vpRes.bullish;
    const obvPer  = Math.min(n, 8);
    const obvOk   = detectOBVDivergence(closes, vols, obvPer);
    const lbLook  = Math.min(n, 5);
    const lbRes   = detectLargeBlocks(closes, opens, vols, lbLook, 1);
    const lbOk    = lbRes.detected;

    const count = [adOk, cmfOk, vpOk, obvOk, lbOk].filter(Boolean).length;
    return count * 20;
  }

  const s = scoreWindow(10);   // short  ~2 weeks
  const m = scoreWindow(20);   // medium ~1 month
  const l = scoreWindow(40);   // long   ~2 months

  const consistent = s >= 40 && m >= 40 && l >= 40;
  const passing = [s, m, l].filter(v => v >= 40).length;
  const label = consistent
    ? '3/3 Consistent'
    : passing === 2
      ? '2/3 Moderate'
      : passing === 1
        ? '1/3 Weak'
        : '0/3 No Signal';

  return { s, m, l, label };
}

