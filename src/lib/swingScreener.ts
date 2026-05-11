import { yf } from './yahooFinance2';
import { calculateTA, TAData } from './technicalIndicators';
import { computeAccumulation, AccumulationSignals } from './accumulationProxy';
import { historyCache, CACHE_TTL } from './cache';

export interface ScreenerResult {
  symbol: string;
  market: 'US' | 'ID';
  taScore: number;
  taData: TAData | null;
  smartMoney: AccumulationSignals | null;
  signals: string[];
  isPass: boolean;
  error?: string;
}

export type Preset = 'DEFAULT' | 'BREAKOUT' | 'OVERSOLD' | 'SMART_MONEY' | 'VOLUME_CLIMAX' | 'SHORT_SQUEEZE';

export async function runScreenerForSymbol(
  symbol: string,
  market: 'US' | 'ID',
  preset: Preset = 'DEFAULT'
): Promise<ScreenerResult> {
  const cleanSymbol = symbol.toUpperCase().replace('.JK', '').replace('.JKT', '').trim();
  const querySymbol = market === 'ID' && !symbol.endsWith('.JK') ? `${cleanSymbol}.JK` : cleanSymbol;
  const historyCacheKey = `history:${cleanSymbol}:${market}:12`;

  const result: ScreenerResult = {
    symbol,
    market,
    taScore: 0,
    taData: null,
    smartMoney: null,
    signals: [],
    isPass: false
  };

  try {
    // ──────────────────────────────────────────────
    // STEP 1: Fetch History (same as before)
    // ──────────────────────────────────────────────
    let history = historyCache.get<any[]>(historyCacheKey);
    if (!history) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 365);

      const chartData = await yf.chart(querySymbol, {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d'
      });
      history = chartData.quotes;
      if (history && history.length > 0) {
        historyCache.set(historyCacheKey, history, CACHE_TTL.HISTORICAL);
      }
    }

    if (!history || history.length < 50) {
      result.error = 'Insufficient historical data';
      return result;
    }

    // ──────────────────────────────────────────────
    // STEP 2: Smart Money Proxy — RUNS FIRST
    // Compute accumulation signals from OHLCV data.
    // No additional API calls needed.
    //
    // Accumulation thresholds per preset:
    //   DEFAULT:       60 (3/5 signals — genuine accumulation)
    //   SMART_MONEY:   80 (4/5 signals — strong conviction)
    //   BREAKOUT:      60 (3/5 — accumulation + breakout pattern)
    //   VOLUME_CLIMAX: 60 (3/5 — accumulation + volume explosion)
    //   OVERSOLD:      40 (2/5 — more lenient; early accumulation in beaten-down stocks)
    //   SHORT_SQUEEZE: 60 (3/5 — accumulation fueling squeeze)
    // ──────────────────────────────────────────────
    const accThresholdMap: Record<Preset, number> = {
      DEFAULT: 60,
      SMART_MONEY: 80,
      BREAKOUT: 60,
      VOLUME_CLIMAX: 60,
      OVERSOLD: 40,
      SHORT_SQUEEZE: 60,
    };
    const accThreshold = accThresholdMap[preset];
    const accumulation = computeAccumulation(history, accThreshold);
    result.smartMoney = accumulation;

    // Early exit: if not accumulating, skip full TA computation.
    // This is both architecturally correct (follow smart money first)
    // and a performance optimization for large universes.
    if (!accumulation.isAccumulating) {
      result.isPass = false;
      return result;
    }

    // ──────────────────────────────────────────────
    // STEP 3: Calculate TA (only for accumulating stocks)
    // ──────────────────────────────────────────────
    const ta = calculateTA(history);
    if (!ta) {
      result.error = 'Failed to calculate TA';
      return result;
    }
    result.taData = ta;

    // ──────────────────────────────────────────────
    // STEP 4: Score TA and Evaluate Presets
    // ──────────────────────────────────────────────
    let trendScore = 0; // max 30
    let volScore = 0;   // max 30
    let momScore = 0;   // max 25
    let structScore = 0; // max 15
    const signals: string[] = [];

    // Add accumulation-specific signals
    if (accumulation.accumulationScore >= 80) signals.push('Strong Accumulation');
    else if (accumulation.accumulationScore >= 60) signals.push('Accumulation');
    if (accumulation.obvDivergence) signals.push('OBV Divergence');
    if (accumulation.largeBlockBuying) signals.push('Block Buying');

    // Trend
    const price = ta.close;
    if (ta.ema20 && price > ta.ema20) trendScore += 10;
    if (ta.ema50 && ta.ema20 && ta.ema20 > ta.ema50) trendScore += 10;
    if (ta.ema200 && ta.ema50 && ta.ema50 > ta.ema200) trendScore += 5;
    if (ta.supertrendBullish) {
      trendScore += 5;
      signals.push('Supertrend Bullish');
    }

    // Volume
    if (ta.volumeRatio) {
      if (ta.volumeRatio >= 2.0) { volScore += 15; signals.push('Volume Surge'); }
      else if (ta.volumeRatio >= 1.5) volScore += 10;
      else if (ta.volumeRatio >= 1.0) volScore += 5;
    }
    if (ta.obvTrendPositive) volScore += 10;
    if (ta.mfi && ta.mfi > 50) volScore += 5;

    // Momentum
    if (ta.rsi) {
      if (ta.rsi >= 40 && ta.rsi <= 65) momScore += 10;
      else if (ta.rsi > 65) { momScore += 5; signals.push('RSI Extended'); }
      else { momScore += 0; signals.push('RSI Weak'); }
    }
    if (ta.stochRecovery) {
      momScore += 10;
      signals.push('Stochastic Oversold Recovery');
    } else if (ta.stochK && ta.stochD && ta.stochK > ta.stochD) {
      momScore += 5;
    }
    if (ta.cci && ta.cci > 0) momScore += 5;

    // Structure
    if (ta.atrPercent && ta.atrPercent >= 1.5 && ta.atrPercent <= 8) structScore += 5;
    if (ta.bollingerB && ta.bollingerB > 0.4 && ta.bollingerB < 0.9) structScore += 5;
    if (ta.distanceTo52wHigh && ta.distanceTo52wHigh > 0.03) structScore += 2;
    if (ta.distanceToS1 && ta.distanceToS1 >= 0 && ta.distanceToS1 <= 0.05) {
      structScore += 3;
      signals.push('Near Pivot Support');
    }

    const totalTaScore = trendScore + volScore + momScore + structScore;
    result.taScore = totalTaScore;

    // ──────────────────────────────────────────────
    // STEP 5: Evaluate Presets
    // Accumulation is already guaranteed at this point
    // (non-accumulating stocks were early-returned above).
    // Each preset adds additional TA requirements on top of
    // the accumulation gate.
    // ──────────────────────────────────────────────
    let taPass = totalTaScore >= 60;

    if (preset === 'BREAKOUT') {
      // Accumulation (≥3/5) + breakout technical setup
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 2.0 : false;
      const adxReq = ta.adx ? ta.adx > 25 : false;
      const bbReq = ta.bollingerB ? ta.bollingerB > 0.8 : false;
      taPass = taPass && volReq && adxReq && bbReq;
      if (taPass) signals.push('Swing Breakout Setup');
    }
    else if (preset === 'OVERSOLD') {
      // Early accumulation (≥2/5) + oversold bounce pattern
      // Lower TA threshold since these are recovery plays
      taPass = totalTaScore >= 40;
      const rsiReq = ta.rsi ? ta.rsi >= 30 && ta.rsi <= 55 : false;
      const pivotReq = ta.distanceToS1 ? ta.distanceToS1 <= 0.05 && ta.distanceToS1 >= -0.02 : false;
      taPass = taPass && rsiReq && pivotReq;
      if (taPass) signals.push('Oversold Bounce Setup');
    }
    else if (preset === 'SMART_MONEY') {
      // Strong accumulation (≥4/5) + MACD momentum confirmation
      const macdReq = ta.macdIncreasing;
      taPass = taPass && macdReq;
      if (taPass) signals.push('Smart Money Flow Confirmation');
    }
    else if (preset === 'VOLUME_CLIMAX') {
      // Accumulation (≥3/5) + extreme volume event
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const emaReq = ta.ema50 ? price > ta.ema50 : false;
      const rsiReq = ta.rsi ? ta.rsi < 70 : false;
      taPass = taPass && volReq && emaReq && rsiReq;
      if (taPass) signals.push('Volume Climax Setup');
    }
    else if (preset === 'SHORT_SQUEEZE') {
      // Accumulation (≥3/5) + squeeze pattern (US only in practice)
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 2.5 : false;
      const emaReq = ta.ema20 ? price > ta.ema20 : false;
      const stochReq = ta.stochRecovery;
      taPass = taPass && volReq && emaReq && stochReq;
      if (taPass) signals.push('Short Squeeze Setup');
    }

    result.signals = signals;
    result.isPass = taPass;

    return result;
  } catch (err: any) {
    result.error = err.message;
    return result;
  }
}
