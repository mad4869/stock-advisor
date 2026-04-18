import { RSI, MACD, SMA, EMA, BollingerBands, ATR, Stochastic, ADX } from 'technicalindicators';
import { HistoricalData, TechnicalIndicators } from '@/types';

export function calculateIndicators(data: HistoricalData[]): TechnicalIndicators {
  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);

  // RSI (14-period)
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;

  // MACD (12, 26, 9)
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macdLatest = macdValues.length > 0 ? macdValues[macdValues.length - 1] : null;
  const macd = macdLatest
    ? {
        MACD: macdLatest.MACD ?? 0,
        signal: macdLatest.signal ?? 0,
        histogram: macdLatest.histogram ?? 0,
      }
    : null;

  // SMAs
  const sma20Values = SMA.calculate({ values: closes, period: 20 });
  const sma50Values = SMA.calculate({ values: closes, period: 50 });
  const sma200Values = SMA.calculate({ values: closes, period: 200 });
  const sma20 = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1] : null;
  const sma50 = sma50Values.length > 0 ? sma50Values[sma50Values.length - 1] : null;
  const sma200 = sma200Values.length > 0 ? sma200Values[sma200Values.length - 1] : null;

  // EMAs
  const ema12Values = EMA.calculate({ values: closes, period: 12 });
  const ema26Values = EMA.calculate({ values: closes, period: 26 });
  const ema12 = ema12Values.length > 0 ? ema12Values[ema12Values.length - 1] : null;
  const ema26 = ema26Values.length > 0 ? ema26Values[ema26Values.length - 1] : null;

  // Bollinger Bands (20, 2)
  const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const bbLatest = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;
  const bollingerBands = bbLatest
    ? { upper: bbLatest.upper, middle: bbLatest.middle, lower: bbLatest.lower }
    : null;

  // ATR (14-period)
  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const atr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : null;

  // Stochastic (14, 3, 3)
  const stochValues = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3,
  });
  const stochLatest = stochValues.length > 0 ? stochValues[stochValues.length - 1] : null;
  const stochastic = stochLatest ? { k: stochLatest.k, d: stochLatest.d } : null;

  // ADX (14-period)
  const adxValues = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const adxLatest = adxValues.length > 0 ? adxValues[adxValues.length - 1] : null;
  const adx = adxLatest ? adxLatest.adx : null;

  // OBV Trend (simplified)
  let obv = 0;
  const obvArray: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvArray.push(obv);
  }
  const obvSma = obvArray.length >= 20
    ? obvArray.slice(-20).reduce((a, b) => a + b, 0) / 20
    : null;
  const obvTrend: 'rising' | 'falling' | 'neutral' =
    obvSma !== null
      ? obv > obvSma
        ? 'rising'
        : obv < obvSma
          ? 'falling'
          : 'neutral'
      : 'neutral';

  return {
    rsi,
    macd,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    bollingerBands,
    atr,
    stochastic,
    adx,
    obvTrend,
  };
}