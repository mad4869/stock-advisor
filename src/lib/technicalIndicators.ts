import {
  EMA,
  MACD,
  ADX,
  RSI,
  Stochastic,
  CCI,
  OBV,
  MFI,
  ATR,
  BollingerBands,
  SMA,
  PSAR
} from 'technicalindicators';
import { Market } from '@/types';
import { roundToIDXTick } from './tickUtils';

export interface TAData {
  close: number;
  high: number;
  low: number;
  volume: number;
  
  // Trend
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  macdHistogram: number | null;
  macdIncreasing: boolean;
  adx: number | null;
  plusDi: number | null;
  minusDi: number | null;
  supertrendBullish: boolean | null;

  // Momentum
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  stochRecovery: boolean;
  cci: number | null;
  williamsR: number | null;

  // Volume
  volume20Avg: number | null;
  volumeRatio: number | null;
  obvTrendPositive: boolean;
  mfi: number | null;
  vwap: number | null;

  // Volatility & Structure
  atrPercent: number | null;
  bollingerB: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  distanceTo52wHigh: number | null; // e.g. 0.05 for 5% away
  pivotS1: number | null;
  distanceToS1: number | null; // e.g. 0.02 for 2% away
  pivotR1: number | null;
  distanceToR1: number | null; // e.g. 0.02 for 2% away
  psar: number | null;

  // Ichimoku Cloud
  tenkanSen: number | null;
  kijunSen: number | null;
  senkouSpanA: number | null;
  senkouSpanB: number | null;

  // Fibonacci Retracement Levels
  fibonacciLevels: {
    high: number;
    low: number;
    fib236: number;
    fib382: number;
    fib500: number;
    fib618: number;
    fib786: number;
  } | null;

  // Trend Crossover Recency
  emaCrossoverRecency: number | null;
  priceCrossoverRecency: number | null;
  macdCrossoverRecency: number | null;
}

export function calculateTA(historicalData: any[], market?: Market): TAData | null {
  // historicalData is expected to be oldest to newest
  if (!historicalData || historicalData.length < 20) return null;

  // Filter out bars with null/zero OHLCV values that would corrupt calculations
  const validData = historicalData.filter(
    (d: any) => d.close != null && d.close > 0 &&
                d.high != null && d.high > 0 &&
                d.low != null && d.low > 0 &&
                d.open != null && d.open > 0
  );

  if (validData.length < 20) return null;

  const closes = validData.map((d: any) => d.close);
  const highs = validData.map((d: any) => d.high);
  const lows = validData.map((d: any) => d.low);
  const volumes = validData.map((d: any) => d.volume || 0); // Volume 0 is valid (no trades)
  
  const currentClose = closes[closes.length - 1];
  const currentHigh = highs[highs.length - 1];
  const currentLow = lows[lows.length - 1];
  const currentVolume = volumes[volumes.length - 1];

  // Helper to get last value
  const getLast = (arr: any[]) => arr.length > 0 ? arr[arr.length - 1] : null;

  // EMA
  const ema20 = getLast(EMA.calculate({ period: 20, values: closes }));
  const ema50 = getLast(EMA.calculate({ period: 50, values: closes }));
  const ema200 = getLast(EMA.calculate({ period: 200, values: closes }));

  // SMA
  const sma20 = getLast(SMA.calculate({ period: 20, values: closes }));
  const sma50 = getLast(SMA.calculate({ period: 50, values: closes }));
  const sma200 = getLast(SMA.calculate({ period: 200, values: closes }));

  // MACD
  const macdData = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  
  let macdHistogram = null;
  let macdIncreasing = false;
  if (macdData.length >= 2) {
    const last1 = macdData[macdData.length - 1].histogram;
    const last2 = macdData[macdData.length - 2].histogram;
    macdHistogram = last1 !== undefined ? last1 : null;
    if (last1 != null && last2 != null) {
      macdIncreasing = last1 > last2;
    }
  }

  // ADX
  const adxData = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14
  });
  const adxOut = getLast(adxData);
  const adx = adxOut?.adx ?? null;
  const plusDi = adxOut?.pdi ?? null;
  const minusDi = adxOut?.mdi ?? null;

  // Supertrend (Custom manual calc)
  // Supertrend relies on ATR and Upper/Lower bands. We'll do a simplified 10, 3 Supertrend.
  const atrData10 = ATR.calculate({ high: highs, low: lows, close: closes, period: 10 });
  let supertrendBullish: boolean | null = null;
  if (atrData10.length > 0) {
    // A simplified Supertrend check for the final bar:
    // This isn't a full historical supertrend, but a proxy:
    // If Close > (High+Low)/2 - (3 * ATR), it's likely bullish if it hasn't crossed below recently.
    // To do it properly we need to iterate.
    // Improved Supertrend proxy:
    const atrOffset = closes.length - atrData10.length;
    let upperBand = (highs[atrOffset] + lows[atrOffset]) / 2 + (3 * atrData10[0]);
    let lowerBand = (highs[atrOffset] + lows[atrOffset]) / 2 - (3 * atrData10[0]);
    let inUptrend = closes[atrOffset] > lowerBand;
    
    for (let i = atrOffset + 1; i < closes.length; i++) {
      const hl2 = (highs[i] + lows[i]) / 2;
      const atrVal = atrData10[i - atrOffset];
      const upperBandBasic = hl2 + (3 * atrVal);
      const lowerBandBasic = hl2 - (3 * atrVal);
      
      if (inUptrend) {
        if (closes[i] < lowerBand) {
          inUptrend = false;
          upperBand = upperBandBasic;
          lowerBand = lowerBandBasic;
        } else {
          lowerBand = Math.max(lowerBand, lowerBandBasic);
        }
      } else {
        if (closes[i] > upperBand) {
          inUptrend = true;
          lowerBand = lowerBandBasic;
          upperBand = upperBandBasic;
        } else {
          upperBand = Math.min(upperBand, upperBandBasic);
        }
      }
    }
    supertrendBullish = inUptrend;
  }

  // RSI
  const rsi = getLast(RSI.calculate({ values: closes, period: 14 }));

  // Stochastic (14,3,3)
  const stochData = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3
  });
  
  // Custom smoothed %D since `technicalindicators` Stochastic returns %K and %D without the 2nd smoothing sometimes,
  // Actually it provides k and d. Let's smooth it if we want 14,3,3. The library standard is usually 14,3.
  // We'll use the output k and d.
  let stochK = null;
  let stochD = null;
  let stochRecovery = false;
  if (stochData.length >= 2) {
    const lastStoch = stochData[stochData.length - 1];
    const prevStoch = stochData[stochData.length - 2];
    stochK = lastStoch.k;
    stochD = lastStoch.d;
    
    // stochK > stochD and rising from below 30
    stochRecovery = (stochK > stochD) && (stochK > prevStoch.k) && (prevStoch.k < 30);
  }

  // CCI
  const cciData = CCI.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 20
  });
  const cci = getLast(cciData);

  // Volume 20 avg
  const volSma = SMA.calculate({ period: 20, values: volumes });
  const volume20Avg = getLast(volSma);
  const volumeRatio = volume20Avg && volume20Avg > 0 ? currentVolume / volume20Avg : null;

  // OBV
  const obvData = OBV.calculate({ close: closes, volume: volumes });
  let obvTrendPositive = false;
  if (obvData.length >= 5) {
    const obvLast = obvData[obvData.length - 1];
    const obv5ago = obvData[obvData.length - 5];
    obvTrendPositive = obvLast > obv5ago;
  }

  // MFI
  const mfi = getLast(MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period: 14 }));

  // ATR %
  const atrData = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const atr = getLast(atrData);
  const atrPercent = atr && currentClose > 0 ? (atr / currentClose) * 100 : null;

  // Bollinger %B
  const bbData = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const bb = getLast(bbData);
  let bollingerB = null;
  if (bb && (bb.upper - bb.lower) !== 0) {
    bollingerB = (currentClose - bb.lower) / (bb.upper - bb.lower);
  }

  // 52-week High & Low (assume ~252 trading days)
  const days52W = Math.min(closes.length, 252);
  const high52WArr = highs.slice(highs.length - days52W);
  const fiftyTwoWeekHigh = high52WArr.length > 0 ? Math.max(...high52WArr) : null;
  let distanceTo52wHigh = null;
  if (fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0) {
    distanceTo52wHigh = (fiftyTwoWeekHigh - currentClose) / fiftyTwoWeekHigh;
  }

  const low52WArr = lows.slice(lows.length - days52W);
  const fiftyTwoWeekLow = low52WArr.length > 0 ? Math.min(...low52WArr) : null;

  // Fibonacci Retracement Levels
  let fibonacciLevels: any = null;
  if (fiftyTwoWeekHigh != null && fiftyTwoWeekLow != null && fiftyTwoWeekHigh > fiftyTwoWeekLow) {
    const diff = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    fibonacciLevels = {
      high: fiftyTwoWeekHigh,
      low: fiftyTwoWeekLow,
      fib236: fiftyTwoWeekHigh - diff * 0.236,
      fib382: fiftyTwoWeekHigh - diff * 0.382,
      fib500: fiftyTwoWeekHigh - diff * 0.500,
      fib618: fiftyTwoWeekHigh - diff * 0.618,
      fib786: fiftyTwoWeekHigh - diff * 0.786,
    };
  }

  // Williams %R (14 periods)
  let williamsR = null;
  if (closes.length >= 14) {
    const sliceHighs = highs.slice(highs.length - 14);
    const sliceLows = lows.slice(lows.length - 14);
    const hh = Math.max(...sliceHighs);
    const ll = Math.min(...sliceLows);
    williamsR = (hh - ll) !== 0 ? ((hh - currentClose) / (hh - ll)) * -100 : null;
  }

  // VWAP (rolling 20-day VWAP)
  let vwap = null;
  if (closes.length >= 20) {
    let sumPriceVol = 0;
    let sumVol = 0;
    for (let i = closes.length - 20; i < closes.length; i++) {
      sumPriceVol += closes[i] * volumes[i];
      sumVol += volumes[i];
    }
    vwap = sumVol > 0 ? sumPriceVol / sumVol : null;
  }

  // Parabolic SAR
  let psar = null;
  try {
    const psarData = PSAR.calculate({
      high: highs,
      low: lows,
      step: 0.02,
      max: 0.2,
    });
    psar = getLast(psarData) ?? null;
  } catch (e) {
    // Graceful fallback if calculation fails
  }

  // Ichimoku Cloud
  let tenkanSen = null;
  let kijunSen = null;
  let senkouSpanA = null;
  let senkouSpanB = null;
  if (closes.length >= 9) {
    const h9 = highs.slice(highs.length - 9);
    const l9 = lows.slice(lows.length - 9);
    tenkanSen = (Math.max(...h9) + Math.min(...l9)) / 2;
  }
  if (closes.length >= 26) {
    const h26 = highs.slice(highs.length - 26);
    const l26 = lows.slice(lows.length - 26);
    kijunSen = (Math.max(...h26) + Math.min(...l26)) / 2;
  }
  if (closes.length >= 52) {
    // Cloud values for the current bar are calculated from 26 periods ago
    const startIdx9 = highs.length - 9 - 26;
    const startIdx26 = highs.length - 26 - 26;
    const startIdx52 = highs.length - 52 - 26;

    if (startIdx9 >= 0 && startIdx26 >= 0 && startIdx52 >= 0) {
      const h9_26 = highs.slice(startIdx9, highs.length - 26);
      const l9_26 = lows.slice(startIdx9, lows.length - 26);
      const tenkan_26 = (Math.max(...h9_26) + Math.min(...l9_26)) / 2;

      const h26_26 = highs.slice(startIdx26, highs.length - 26);
      const l26_26 = lows.slice(startIdx26, lows.length - 26);
      const kijun_26 = (Math.max(...h26_26) + Math.min(...l26_26)) / 2;

      senkouSpanA = (tenkan_26 + kijun_26) / 2;

      const h52_26 = highs.slice(startIdx52, highs.length - 26);
      const l52_26 = lows.slice(startIdx52, lows.length - 26);
      senkouSpanB = (Math.max(...h52_26) + Math.min(...l52_26)) / 2;
    }
  }

  // Pivot S1 & R1
  // Pivot Points using previous day's H, L, C
  let pivotS1 = null;
  let pivotR1 = null;
  let distanceToS1 = null;
  let distanceToR1 = null;
  if (highs.length >= 2) {
    const prevH = highs[highs.length - 2];
    const prevL = lows[lows.length - 2];
    const prevC = closes[closes.length - 2];
    const pivot = (prevH + prevL + prevC) / 3;
    
    const rawS1 = (pivot * 2) - prevH;
    pivotS1 = market === 'ID' ? roundToIDXTick(rawS1) : rawS1;
    if (pivotS1 > 0) {
      // Distance from price to S1. Positive means price is above S1.
      distanceToS1 = (currentClose - pivotS1) / pivotS1;
    }

    const rawR1 = (pivot * 2) - prevL;
    pivotR1 = market === 'ID' ? roundToIDXTick(rawR1) : rawR1;
    if (pivotR1 > 0) {
      // Distance from price to R1. Positive means price is below R1.
      distanceToR1 = (pivotR1 - currentClose) / pivotR1;
    }
  }

  // Trend Crossover Recency
  const ema20Full = EMA.calculate({ period: 20, values: closes });
  const ema50Full = EMA.calculate({ period: 50, values: closes });
  const emaCrossoverRecency = findCrossoverRecency(ema20Full, ema50Full, 20);
  const priceCrossoverRecency = findCrossoverRecency(closes, ema20Full, 20);

  const macdLines = macdData.map(d => d.MACD ?? 0);
  const macdSignals = macdData.map(d => d.signal ?? 0);
  const macdCrossoverRecency = findCrossoverRecency(macdLines, macdSignals, 20);

  return {
    close: currentClose,
    high: currentHigh,
    low: currentLow,
    volume: currentVolume,
    ema20,
    ema50,
    ema200,
    sma20,
    sma50,
    sma200,
    macdHistogram,
    macdIncreasing,
    adx,
    plusDi,
    minusDi,
    supertrendBullish,
    rsi,
    stochK,
    stochD,
    stochRecovery,
    cci,
    williamsR,
    volume20Avg,
    volumeRatio,
    obvTrendPositive,
    mfi,
    vwap,
    atrPercent,
    bollingerB,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    distanceTo52wHigh,
    pivotS1,
    distanceToS1,
    pivotR1,
    distanceToR1,
    psar,
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    fibonacciLevels,
    emaCrossoverRecency,
    priceCrossoverRecency,
    macdCrossoverRecency
  };
}

/**
 * Finds how many bars ago a bullish crossover occurred (fast crossed above slow).
 * Returns null if no crossover within the maxLookback period.
 */
function findCrossoverRecency(
  fastValues: number[],
  slowValues: number[],
  maxLookback: number = 20
): number | null {
  const len = Math.min(fastValues.length, slowValues.length);
  if (len < 2) return null;

  const fastEnd = fastValues.slice(fastValues.length - len);
  const slowEnd = slowValues.slice(slowValues.length - len);

  for (let i = 0; i < Math.min(len - 1, maxLookback); i++) {
    const idx = len - 1 - i;
    const currentFast = fastEnd[idx];
    const currentSlow = slowEnd[idx];
    const prevFast = fastEnd[idx - 1];
    const prevSlow = slowEnd[idx - 1];

    if (currentFast > currentSlow && prevFast <= prevSlow) {
      return i; // 0 means crossover on current bar
    }
  }
  return null;
}
