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
  SMA
} from 'technicalindicators';

export interface TAData {
  close: number;
  high: number;
  low: number;
  volume: number;
  
  // Trend
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  macdHistogram: number | null;
  macdIncreasing: boolean;
  adx: number | null;
  supertrendBullish: boolean | null;

  // Momentum
  rsi: number | null;
  stochK: number | null;
  stochD: number | null;
  stochRecovery: boolean;
  cci: number | null;

  // Volume
  volume20Avg: number | null;
  volumeRatio: number | null;
  obvTrendPositive: boolean;
  mfi: number | null;

  // Volatility & Structure
  atrPercent: number | null;
  bollingerB: number | null;
  fiftyTwoWeekHigh: number | null;
  distanceTo52wHigh: number | null; // e.g. 0.05 for 5% away
  pivotS1: number | null;
  distanceToS1: number | null; // e.g. 0.02 for 2% away
}

export function calculateTA(historicalData: any[]): TAData | null {
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
  const adx = getLast(adxData)?.adx ?? null;

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

  // 52-week High (assume ~252 trading days)
  const days52W = Math.min(closes.length, 252);
  const high52WArr = highs.slice(highs.length - days52W);
  const fiftyTwoWeekHigh = high52WArr.length > 0 ? Math.max(...high52WArr) : null;
  let distanceTo52wHigh = null;
  if (fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0) {
    distanceTo52wHigh = (fiftyTwoWeekHigh - currentClose) / fiftyTwoWeekHigh;
  }

  // Pivot S1
  // Pivot Points using previous day's H, L, C
  let pivotS1 = null;
  let distanceToS1 = null;
  if (highs.length >= 2) {
    const prevH = highs[highs.length - 2];
    const prevL = lows[lows.length - 2];
    const prevC = closes[closes.length - 2];
    const pivot = (prevH + prevL + prevC) / 3;
    pivotS1 = (pivot * 2) - prevH;
    
    if (pivotS1 > 0) {
      // Distance from price to S1. Positive means price is above S1.
      distanceToS1 = (currentClose - pivotS1) / pivotS1;
    }
  }

  return {
    close: currentClose,
    high: currentHigh,
    low: currentLow,
    volume: currentVolume,
    ema20,
    ema50,
    ema200,
    macdHistogram,
    macdIncreasing,
    adx,
    supertrendBullish,
    rsi,
    stochK,
    stochD,
    stochRecovery,
    cci,
    volume20Avg,
    volumeRatio,
    obvTrendPositive,
    mfi,
    atrPercent,
    bollingerB,
    fiftyTwoWeekHigh,
    distanceTo52wHigh,
    pivotS1,
    distanceToS1
  };
}
