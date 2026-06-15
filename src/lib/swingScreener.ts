import { yf, getComprehensiveAnalysis2 } from './yahooFinance2';
import { calculateTA, TAData } from './technicalIndicators';
import { computeAccumulation, AccumulationSignals } from './accumulationProxy';
import { historyCache, singleScreenerCache, CACHE_TTL } from './cache';
import { Market, SwingScreenerResult } from '@/types';
import { detectRedFlags } from './redFlags';

export type Preset = 'DEFAULT' | 'BREAKOUT' | 'OVERSOLD' | 'SMART_MONEY' | 'VOLUME_CLIMAX' | 'SHORT_SQUEEZE' | 'MA_TREND';

interface MarketConfig {
  minVolume20Avg: number; // absolute volume floor
  rsiOverbought: number;
  rsiOversold: number;
  volumeRatioBullish: number;
  volumeRatioSurge: number;
  minAtrPercent: number;
  maxAtrPercent: number;
}

const MARKET_CONFIGS: Record<Market, MarketConfig> = {
  US: {
    minVolume20Avg: 100000,    // US stocks should have at least 100k daily average volume
    rsiOverbought: 70,
    rsiOversold: 30,
    volumeRatioBullish: 1.5,
    volumeRatioSurge: 2.0,
    minAtrPercent: 1.0,
    maxAtrPercent: 8.0,
  },
  ID: {
    minVolume20Avg: 1000000,   // IDX stocks should have at least 1M daily average volume (Rp liquidity)
    rsiOverbought: 80,         // IDX stocks can stay overbought longer
    rsiOversold: 35,
    volumeRatioBullish: 1.5,
    volumeRatioSurge: 2.5,     // IDX needs higher volume surge due to speculative retail spikes
    minAtrPercent: 1.5,
    maxAtrPercent: 12.0,       // IDX has higher average volatility
  }
};

export async function runScreenerForSymbol(
  symbol: string,
  market: Market,
  preset: Preset = 'DEFAULT'
): Promise<SwingScreenerResult> {
  const cleanSymbol = symbol.toUpperCase().replace('.JK', '').replace('.JKT', '').trim();
  const cacheKey = `singleScreener:${cleanSymbol}:${market}:${preset}`;
  const cached = singleScreenerCache.get<SwingScreenerResult>(cacheKey);
  if (cached) return cached;

  const result = await runScreenerForSymbolRaw(symbol, market, preset);
  singleScreenerCache.set(cacheKey, result, CACHE_TTL.SINGLE_SCREENER);
  return result;
}

async function runScreenerForSymbolRaw(
  symbol: string,
  market: Market,
  preset: Preset = 'DEFAULT'
): Promise<SwingScreenerResult> {
  const cleanSymbol = symbol.toUpperCase().replace('.JK', '').replace('.JKT', '').trim();
  const querySymbol = market === 'ID' ? `${cleanSymbol}.JK` : cleanSymbol;
  const historyCacheKey = `history:${cleanSymbol}:${market}:12`;

  const result: SwingScreenerResult = {
    symbol: cleanSymbol,
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
      MA_TREND: 60,
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
    const config = MARKET_CONFIGS[market];

    // ──────────────────────────────────────────────
    // STEP 3: Calculate TA (only for accumulating stocks)
    // ──────────────────────────────────────────────
    const ta = calculateTA(history, market);
    if (!ta) {
      result.error = 'Failed to calculate TA';
      return result;
    }

    // Absolute volume floor check
    if (ta.volume20Avg && ta.volume20Avg < config.minVolume20Avg) {
      result.error = 'Insufficient liquidity';
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

    // Trend Crossover Recency Weighting (Bonuses)
    if (ta.emaCrossoverRecency !== null && ta.emaCrossoverRecency <= 10) {
      const bonus = ta.emaCrossoverRecency <= 5 ? 5 : 3;
      trendScore += bonus;
      signals.push(`Recent Golden Cross (${ta.emaCrossoverRecency}d ago)`);
    }
    if (ta.macdCrossoverRecency !== null && ta.macdCrossoverRecency <= 10) {
      const bonus = ta.macdCrossoverRecency <= 5 ? 5 : 3;
      trendScore += bonus;
      signals.push(`Recent MACD Bullish Cross (${ta.macdCrossoverRecency}d ago)`);
    }
    if (ta.priceCrossoverRecency !== null && ta.priceCrossoverRecency <= 5) {
      trendScore += 3;
      signals.push(`Recent Price EMA20 Cross (${ta.priceCrossoverRecency}d ago)`);
    }

    // Volume
    if (ta.volumeRatio) {
      if (ta.volumeRatio >= config.volumeRatioSurge) { volScore += 15; signals.push('Volume Surge'); }
      else if (ta.volumeRatio >= config.volumeRatioBullish) volScore += 10;
      else if (ta.volumeRatio >= 1.0) volScore += 5;
    }
    if (ta.obvTrendPositive) volScore += 10;
    if (ta.mfi && ta.mfi > 50) volScore += 5;

    // Momentum
    if (ta.rsi) {
      const rsiVal = ta.rsi;
      const overbought = config.rsiOverbought;
      const midHigh = overbought - 5;
      const upperLimit = overbought + 10;
      
      let rsiScore = 0;
      if (rsiVal < 30) {
        rsiScore = 0;
        signals.push('RSI Weak');
      } else if (rsiVal < 45) {
        rsiScore = ((rsiVal - 30) / 15) * 10;
        if (rsiVal < 40) signals.push('RSI Weak');
      } else if (rsiVal <= midHigh) {
        rsiScore = 10;
      } else if (rsiVal <= overbought) {
        const ratio = (rsiVal - midHigh) / (overbought - midHigh);
        rsiScore = 10 - ratio * 5;
        signals.push('RSI Extended');
      } else if (rsiVal <= upperLimit) {
        const ratio = (rsiVal - overbought) / (upperLimit - overbought);
        rsiScore = 5 - ratio * 5;
        signals.push('RSI Overbought');
      } else {
        rsiScore = 0;
        signals.push('RSI Overbought');
      }
      
      momScore += rsiScore;
    }
    if (ta.stochRecovery) {
      momScore += 10;
      signals.push('Stochastic Oversold Recovery');
    } else if (ta.stochK && ta.stochD && ta.stochK > ta.stochD) {
      momScore += 5;
    }
    if (ta.cci && ta.cci > 0) momScore += 5;

    // Structure
    if (ta.atrPercent && ta.atrPercent >= config.minAtrPercent && ta.atrPercent <= config.maxAtrPercent) structScore += 5;
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
    else if (preset === 'MA_TREND') {
      // Accumulation (≥3/5) + price above all 6 MAs (EMA 20/50/200 + SMA 20/50/200)
      // Slightly relaxed TA score (≥50) since the 6-MA alignment is already a strong structural filter
      taPass = totalTaScore >= 50;
      const aboveEma20 = ta.ema20 != null ? price > ta.ema20 : false;
      const aboveEma50 = ta.ema50 != null ? price > ta.ema50 : false;
      const aboveEma200 = ta.ema200 != null ? price > ta.ema200 : false;
      const aboveSma20 = ta.sma20 != null ? price > ta.sma20 : false;
      const aboveSma50 = ta.sma50 != null ? price > ta.sma50 : false;
      const aboveSma200 = ta.sma200 != null ? price > ta.sma200 : false;
      const allMaAbove = aboveEma20 && aboveEma50 && aboveEma200 && aboveSma20 && aboveSma50 && aboveSma200;
      taPass = taPass && allMaAbove;
      if (taPass) signals.push('Above All MAs (EMA & SMA)');
    }

    if (taPass) {
      try {
        const analysis = await getComprehensiveAnalysis2(cleanSymbol, market);
        const redFlags = detectRedFlags(analysis);
        result.redFlags = redFlags;

        const dangerFlags = redFlags.filter(f => f.severity === 'danger');
        if (dangerFlags.length > 0) {
          taPass = false;
          signals.push(`Blocked by Red Flag: ${dangerFlags[0].title}`);
        }
      } catch (err: any) {
        console.warn(`[Screener] Failed to fetch fundamentals/red flags for ${cleanSymbol}: ${err.message}`);
      }
    }

    result.signals = signals;
    result.isPass = taPass;

    return result;
  } catch (err: any) {
    result.error = err.message;
    return result;
  }
}
