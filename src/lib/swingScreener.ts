import { yf, getComprehensiveAnalysis2 } from './yahooFinance2';
import { calculateTA, TAData } from './technicalIndicators';
import { computeAccumulation, computeAccumulationMultiTimeframe, AccumulationSignals } from './accumulationProxy';
import { PresetCriterion } from '@/types';
import { historyCache, singleScreenerCache, CACHE_TTL } from './cache';
import { Market, SwingScreenerResult } from '@/types';
import { detectRedFlags } from './redFlags';
import { computeFundamentalScore } from './fundamentalScorer';

export type Preset = 'DEFAULT' | 'BREAKOUT' | 'EARLY_BREAKOUT' | 'OVERSOLD' | 'SMART_MONEY' | 'VOLUME_CLIMAX' | 'SHORT_SQUEEZE' | 'MA_TREND' | 'TA_ONLY' | 'STEALTH_ACCUM' | 'BULL_DIV' | 'VOL_SPIKE' | 'CONSISTENCY' | 'DETAIL' | 'HIGH_YIELD_DIVIDEND';

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
    presetCriteria: [],
    consistencyScore: null,
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
      if (history && history.length > 0 && chartData?.meta?.regularMarketPrice > 0) {
        const livePrice = chartData.meta.regularMarketPrice;
        const lastQuote = history[history.length - 1];
        if (lastQuote && lastQuote.close !== livePrice) {
          const lastDate = new Date(lastQuote.date);
          const today = new Date();
          if (lastDate.toDateString() === today.toDateString()) {
            lastQuote.close = livePrice;
            if (livePrice > lastQuote.high) lastQuote.high = livePrice;
            if (livePrice < lastQuote.low) lastQuote.low = livePrice;
            if (chartData.meta.regularMarketVolume) lastQuote.volume = chartData.meta.regularMarketVolume;
          } else if (today.getTime() - lastDate.getTime() > 0) {
            history.push({
              date: today.toISOString(),
              open: chartData.meta.regularMarketOpen ?? livePrice,
              high: chartData.meta.regularMarketDayHigh ?? Math.max(lastQuote.close, livePrice),
              low: chartData.meta.regularMarketDayLow ?? Math.min(lastQuote.close, livePrice),
              close: livePrice,
              volume: chartData.meta.regularMarketVolume ?? 0,
            });
          }
        }
      }
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
      EARLY_BREAKOUT: 40,
      VOLUME_CLIMAX: 60,
      OVERSOLD: 40,
      SHORT_SQUEEZE: 60,
      MA_TREND: 60,
      STEALTH_ACCUM: 40,
      BULL_DIV: 40,
      VOL_SPIKE: 20,     // very lenient — volume anomaly is the primary gate
      CONSISTENCY: 60,   // must accumulate in medium window at minimum
      TA_ONLY: 0,
      DETAIL: 0,
      HIGH_YIELD_DIVIDEND: 0,
    };
    const accThreshold = accThresholdMap[preset];
    const accumulation = computeAccumulation(history, accThreshold);
    result.smartMoney = accumulation;

    // Early exit: if not accumulating, skip full TA computation.
    // This is both architecturally correct (follow smart money first)
    // and a performance optimization for large universes.
    // Exception: TA_ONLY, DETAIL, and HIGH_YIELD_DIVIDEND presets ignore the smart money gate entirely.
    if (!accumulation.isAccumulating && preset !== 'TA_ONLY' && preset !== 'DETAIL' && preset !== 'HIGH_YIELD_DIVIDEND') {
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

    // Absolute volume floor check — skipped for DETAIL and HIGH_YIELD_DIVIDEND preset
    // so the stock detail page always receives full TA data regardless of liquidity.
    result.taData = ta;
    if (preset !== 'DETAIL' && preset !== 'HIGH_YIELD_DIVIDEND' && ta.volume20Avg && ta.volume20Avg < config.minVolume20Avg) {
      result.error = 'Insufficient liquidity';
      return result;
    }

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

    const totalTaScore = Math.round(trendScore + volScore + momScore + structScore);
    result.taScore = totalTaScore;

    // ──────────────────────────────────────────────
    // STEP 5: Evaluate Presets
    // Accumulation is already guaranteed at this point
    // (non-accumulating stocks were early-returned above).
    // Each preset adds additional TA requirements on top of
    // the accumulation gate.
    // ──────────────────────────────────────────────
    let taPass = totalTaScore >= 60;
    const criteria: PresetCriterion[] = [];
    const fmt = (v: number, isId: boolean) => isId ? v.toLocaleString('id-ID') : v.toLocaleString('en-US');
    const isId = market === 'ID';
    const cur = isId ? 'Rp' : '$';

    // Derived metrics from history not present in TAData
    const validH = history.filter((h: any) => h.close > 0);
    const lastH = validH[validH.length - 1] ?? null;
    const h10dAgo = validH.length >= 10 ? validH[validH.length - 10] : null;
    const priceChange10d = lastH && h10dAgo && h10dAgo.close > 0
      ? (lastH.close - h10dAgo.close) / h10dAgo.close
      : null;
    const todayOpen: number | null = lastH?.open ?? null;

    if (preset === 'BREAKOUT') {
      // Accumulation (≥3/5) + breakout technical setup
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const adxReq = ta.adx ? ta.adx > 25 : false;
      const bbReq = ta.bollingerB ? ta.bollingerB > 0.8 : false;
      taPass = taPass && volReq && adxReq && bbReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'Volume Spike', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 3.0x', passed: volReq },
        { label: 'ADX (Trend Strength)', value: ta.adx?.toFixed(1) ?? '—', threshold: '> 25', passed: adxReq },
        { label: 'Bollinger %B', value: ta.bollingerB?.toFixed(2) ?? '—', threshold: '> 0.80', passed: bbReq },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 60', passed: accumulation.accumulationScore >= 60 },
      );
      if (taPass) signals.push('Swing Breakout Setup');
    }
    else if (preset === 'EARLY_BREAKOUT') {
      taPass = totalTaScore >= 50;
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const adxReq = ta.adx ? ta.adx >= 18 : false;
      const bbReq = ta.bollingerB ? ta.bollingerB > 0.65 : false;
      const emaReq = ta.ema20 != null ? price > ta.ema20 : false;
      taPass = taPass && volReq && adxReq && bbReq && emaReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 50', passed: totalTaScore >= 50 },
        { label: 'Volume (Elevated)', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 3.0x', passed: volReq },
        { label: 'ADX (Early Trend)', value: ta.adx?.toFixed(1) ?? '—', threshold: '≥ 18', passed: adxReq },
        { label: 'Bollinger %B', value: ta.bollingerB?.toFixed(2) ?? '—', threshold: '> 0.65', passed: bbReq },
        { label: 'Price vs EMA20', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema20 ? fmt(ta.ema20, isId) : '—'}`, passed: emaReq },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 40', passed: accumulation.accumulationScore >= 40 },
      );
      if (taPass) signals.push('Early Breakout Setup');
    }
    else if (preset === 'OVERSOLD') {
      taPass = totalTaScore >= 40;
      const rsiReq = ta.rsi ? ta.rsi >= 30 && ta.rsi <= 55 : false;
      const pivotReq = ta.distanceToS1 ? ta.distanceToS1 <= 0.05 && ta.distanceToS1 >= -0.02 : false;
      taPass = taPass && rsiReq && pivotReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 40', passed: totalTaScore >= 40 },
        { label: 'RSI (Oversold Zone)', value: ta.rsi?.toFixed(1) ?? '—', threshold: '30–55', passed: rsiReq },
        { label: 'Near Pivot S1', value: ta.distanceToS1 != null ? `${(ta.distanceToS1 * 100).toFixed(1)}%` : '—', threshold: '≤ +5% from S1', passed: pivotReq },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 40', passed: accumulation.accumulationScore >= 40 },
      );
      if (taPass) signals.push('Oversold Bounce Setup');
    }
    else if (preset === 'SMART_MONEY') {
      const macdReq = ta.macdIncreasing;
      taPass = taPass && macdReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 80 (4/5)', passed: accumulation.accumulationScore >= 80 },
        { label: 'MACD Increasing', value: macdReq ? 'Yes' : 'No', threshold: 'Must be rising', passed: macdReq },
        { label: 'Signals Bullish', value: `${accumulation.signalCount}/5`, threshold: '≥ 4/5', passed: accumulation.signalCount >= 4 },
      );
      if (taPass) signals.push('Smart Money Flow Confirmation');
    }
    else if (preset === 'VOLUME_CLIMAX') {
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const emaReq = ta.ema50 != null ? price > ta.ema50 : false;
      const rsiReq = ta.rsi ? ta.rsi < 70 : false;
      taPass = taPass && volReq && emaReq && rsiReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'Volume Spike', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 3.0x', passed: volReq },
        { label: 'Price vs EMA50', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema50 ? fmt(ta.ema50, isId) : '—'}`, passed: emaReq },
        { label: 'RSI (Not Overbought)', value: ta.rsi?.toFixed(1) ?? '—', threshold: '< 70', passed: rsiReq },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 60', passed: accumulation.accumulationScore >= 60 },
      );
      if (taPass) signals.push('Volume Climax Setup');
    }
    else if (preset === 'SHORT_SQUEEZE') {
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const emaReq = ta.ema20 != null ? price > ta.ema20 : false;
      const stochReq = ta.stochRecovery;
      taPass = taPass && volReq && emaReq && stochReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'Volume Spike', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 3.0x', passed: volReq },
        { label: 'Price vs EMA20', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema20 ? fmt(ta.ema20, isId) : '—'}`, passed: emaReq },
        { label: 'Stochastic Recovery', value: stochReq ? 'Yes' : 'No', threshold: 'Oversold → rising', passed: stochReq },
        { label: 'Short Interest', value: '≥10% (checked later)', threshold: '≥ 10% of float', passed: true }, // checked post-fundamentals
      );
      if (taPass) signals.push('Short Squeeze Setup');
    }
    else if (preset === 'MA_TREND') {
      taPass = totalTaScore >= 50;
      const aboveEma20 = ta.ema20 != null ? price > ta.ema20 : false;
      const aboveEma50 = ta.ema50 != null ? price > ta.ema50 : false;
      const aboveEma200 = ta.ema200 != null ? price > ta.ema200 : false;
      const aboveSma20 = ta.sma20 != null ? price > ta.sma20 : false;
      const aboveSma50 = ta.sma50 != null ? price > ta.sma50 : false;
      const aboveSma200 = ta.sma200 != null ? price > ta.sma200 : false;
      const allMaAbove = aboveEma20 && aboveEma50 && aboveEma200 && aboveSma20 && aboveSma50 && aboveSma200;
      taPass = taPass && allMaAbove;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 50', passed: totalTaScore >= 50 },
        { label: 'Price vs EMA20', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema20 ? fmt(ta.ema20, isId) : '—'}`, passed: aboveEma20 },
        { label: 'Price vs EMA50', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema50 ? fmt(ta.ema50, isId) : '—'}`, passed: aboveEma50 },
        { label: 'Price vs EMA200', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema200 ? fmt(ta.ema200, isId) : '—'}`, passed: aboveEma200 },
        { label: 'Price vs SMA20', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.sma20 ? fmt(ta.sma20, isId) : '—'}`, passed: aboveSma20 },
        { label: 'Price vs SMA50', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.sma50 ? fmt(ta.sma50, isId) : '—'}`, passed: aboveSma50 },
        { label: 'Price vs SMA200', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.sma200 ? fmt(ta.sma200, isId) : '—'}`, passed: aboveSma200 },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 60', passed: accumulation.accumulationScore >= 60 },
      );
      if (taPass) signals.push('Above All MAs (EMA & SMA)');
    }
    else if (preset === 'STEALTH_ACCUM') {
      // Stealth Accumulation — finds stocks where smart money is quietly
      // building positions but the price has NOT yet moved visibly.
      // These are early-bird setups *before* BREAKOUT/VOLUME_CLIMAX would fire.
      //
      // Conditions (all must pass):
      //   1. Volume quietly elevated (1.3–2.0x avg) — not a public spike yet
      //   2. Price has NOT moved up meaningfully (≤ +3% over 10 days)
      //   3. OBV rising while price is flat/falling (institutional absorption)
      //   4. CMF positive (≥ 0.05) — intraday closes in upper half of range
      //   5. Stock still coiled: %B < 0.65 AND RSI 35–60
      //   6. ADX < 25 — no established trend yet (calm before the storm)

      // 1. Volume elevated (could be a quiet 1.5x or a massive 3.0x+ absorption day)
      const volElevated = ta.volumeRatio != null && ta.volumeRatio >= 1.5;

      // 2. Price flat or only slightly up (≤ +3%) over the last 10 trading days
      let priceNotMovedYet = false;
      if (history.length >= 10) {
        const price10dAgo = history[history.length - 10]?.close;
        if (price10dAgo && price10dAgo > 0) {
          const priceChange10d = (price - price10dAgo) / price10dAgo;
          priceNotMovedYet = priceChange10d <= 0.03; // ≤ +3% over 10 days
        }
      }

      // 3. OBV divergence — the key institutional absorption fingerprint
      const obvDiv = accumulation.obvDivergence;

      // 4. CMF quietly positive (≥ 0.05)
      const cmfPositive = accumulation.cmf >= 0.05;

      // 5. Stock still coiled — not extended yet
      const bbCoiled = ta.bollingerB != null ? ta.bollingerB < 0.65 : false;
      const rsiSweet = ta.rsi != null ? ta.rsi >= 35 && ta.rsi <= 60 : false;
      const stillCoiled = bbCoiled && rsiSweet;

      // 6. No established trend yet (ADX < 25)
      const noTrendYet = ta.adx != null ? ta.adx < 25 : true; // if ADX unavailable, allow

      taPass = volElevated && priceNotMovedYet && obvDiv && cmfPositive && stillCoiled && noTrendYet;
      criteria.push(
        { label: 'Volume (Absorption)', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 1.5x', passed: volElevated },
        { label: 'Price Not Moved Yet', value: priceChange10d != null ? `${(priceChange10d * 100).toFixed(1)}%` : '—', threshold: '≤ +3% (10d)', passed: priceNotMovedYet },
        { label: 'OBV Divergence', value: obvDiv ? 'Detected' : 'None', threshold: 'OBV rising, price flat', passed: obvDiv },
        { label: 'CMF (Money Flow)', value: accumulation.cmf.toFixed(3), threshold: '≥ 0.05', passed: cmfPositive },
        { label: 'Bollinger %B (Coiled)', value: ta.bollingerB?.toFixed(2) ?? '—', threshold: '< 0.65', passed: ta.bollingerB != null ? ta.bollingerB < 0.65 : false },
        { label: 'RSI (Sweet Spot)', value: ta.rsi?.toFixed(1) ?? '—', threshold: '35–60', passed: ta.rsi != null ? ta.rsi >= 35 && ta.rsi <= 60 : false },
        { label: 'No Established Trend', value: ta.adx?.toFixed(1) ?? '—', threshold: 'ADX < 25', passed: noTrendYet },
      );
      if (taPass) {
        signals.push('Stealth Accumulation — Volume Rising, Price Not Yet');
        if (accumulation.largeBlockBuying) signals.push('Block Buying Detected');
      }
    }
    else if (preset === 'BULL_DIV') {
      // RSI Bullish Divergence — price makes lower lows but RSI makes higher lows.
      // This is a classic hidden-strength reversal signal that fires BEFORE the trend reverses.
      // The stock must be in a pullback or downtrend phase (RSI not already high).
      //
      // Requirements:
      //   1. RSI divergence detected (lower price low + higher RSI low)
      //   2. RSI in the sweet spot: not crashed (≥30), not already recovered (≤60)
      //   3. Some smart money absorption (acc score ≥40 — 2/5 signals)
      //   4. Stochastic recovering OR MACD histogram increasing (momentum starting to turn)

      const divDetected = ta.rsiDivergence;
      const rsiInRange = ta.rsi != null ? ta.rsi >= 30 && ta.rsi <= 62 : false;
      const momentumTurning = ta.stochRecovery || ta.macdIncreasing;

      taPass = divDetected && rsiInRange && momentumTurning;
      criteria.push(
        { label: 'RSI Divergence', value: divDetected ? 'Detected' : 'None', threshold: 'Price LL + RSI HL', passed: divDetected },
        { label: 'RSI (Sweet Spot)', value: ta.rsi?.toFixed(1) ?? '—', threshold: '30–62', passed: rsiInRange },
        { label: 'Momentum Turning', value: ta.stochRecovery ? 'Stoch Recovery' : ta.macdIncreasing ? 'MACD Rising' : 'No', threshold: 'Stoch or MACD', passed: momentumTurning },
        { label: 'OBV Divergence', value: accumulation.obvDivergence ? 'Confirmed' : 'Absent', threshold: 'Supporting signal', passed: accumulation.obvDivergence },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 40', passed: accumulation.accumulationScore >= 40 },
      );
      if (taPass) {
        signals.push('RSI Bullish Divergence — Price Lower Low, RSI Higher Low');
        if (ta.stochRecovery) signals.push('Stochastic Oversold Recovery');
        if (ta.macdIncreasing) signals.push('MACD Histogram Rising');
        if (accumulation.obvDivergence) signals.push('OBV Divergence Confirms');
      }
    }
    else if (preset === 'VOL_SPIKE') {
      // Standalone Volume Anomaly screener — catches stocks like WIFI with a 6.8x spike.
      // Primary gate: today's volume ratio >= 3.0x the 20-day average.
      // Secondary: not a collapsing stock (price change > -5%).
      // Very lenient accumulation gate (20) so even one signal doesn't block it.
      taPass = true; // override — volume is the primary gate, not TA score
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const priceNotCrashing = priceChange10d != null ? priceChange10d > -0.05 : true;
      const upDayReq = ta.close != null && todayOpen != null ? ta.close >= todayOpen * 0.98 : true;
      taPass = volReq && priceNotCrashing && upDayReq;
      criteria.push(
        { label: 'Volume Spike', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 3.0x avg', passed: volReq },
        { label: 'Price Not Crashing', value: priceChange10d != null ? `${(priceChange10d * 100).toFixed(1)}%` : '—', threshold: '> -5% (10d)', passed: priceNotCrashing },
        { label: 'Not Heavy Sell-Off Day', value: upDayReq ? 'OK' : 'Down day', threshold: 'Close ≥ 98% of Open', passed: upDayReq },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 20 (bonus)', passed: accumulation.accumulationScore >= 20 },
      );
      if (taPass) signals.push(`Volume Spike (${ta.volumeRatio?.toFixed(1)}x avg)`);
    }
    else if (preset === 'CONSISTENCY') {
      // Multi-timeframe accumulation consistency.
      // Passes only if accumulation signals are confirmed across ALL 3 timeframes:
      // short (~2 weeks), medium (~1 month), long (~2 months).
      const mtf = computeAccumulationMultiTimeframe(history);
      result.consistencyScore = mtf;
      const shortOk = mtf.s >= 40;
      const mediumOk = mtf.m >= 40;
      const longOk   = mtf.l >= 40;
      taPass = shortOk && mediumOk && longOk;
      criteria.push(
        { label: 'Short-Term (2w)', value: `${mtf.s}/100`, threshold: '≥ 40', passed: shortOk },
        { label: 'Medium-Term (1m)', value: `${mtf.m}/100`, threshold: '≥ 40', passed: mediumOk },
        { label: 'Long-Term (2m)', value: `${mtf.l}/100`, threshold: '≥ 40', passed: longOk },
        { label: 'Consistency Label', value: mtf.label, threshold: '3/3 required', passed: taPass },
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 60', passed: accumulation.accumulationScore >= 60 },
      );
      if (taPass) signals.push(`Consistent Accumulation (${mtf.label})`);
    }
    else if (preset === 'TA_ONLY') {
      taPass = totalTaScore >= 90;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 90 (Elite)', passed: totalTaScore >= 90 },
      );
      if (taPass) signals.push('Elite TA Score (90+)');
    }
    else if (preset === 'DETAIL') {
      taPass = false;
    }
    else if (preset === 'HIGH_YIELD_DIVIDEND') {
      taPass = true; // Bypass TA and Accumulation gates
      criteria.push(
        { label: 'Dividend Yield', value: 'Fetching...', threshold: '≥ 5.0%', passed: false },
        { label: 'Fundamental Score', value: 'Fetching...', threshold: 'For Sorting', passed: true },
        { label: 'Discount from Peak', value: 'Fetching...', threshold: 'For Sorting', passed: true },
      );
      if (taPass) signals.push('Evaluating Yield & Fundamentals...');
    }
    else {
      // DEFAULT: just accumulation + TA score gates, no extra criteria
      criteria.push(
        { label: 'Smart Money Score', value: `${accumulation.accumulationScore}`, threshold: '≥ 60', passed: accumulation.accumulationScore >= 60 },
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'Signals Bullish', value: `${accumulation.signalCount}/5`, threshold: '≥ 3/5', passed: accumulation.signalCount >= 3 },
      );
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
        } else {
          // ── Fundamental Quality Scoring (zero extra API calls) ──
          const fundScore = computeFundamentalScore(analysis, market);
          result.fundamentalScore = {
            total: fundScore.total,
            grade: fundScore.grade,
            valuation: fundScore.valuation,
            growth: fundScore.growth,
            profitability: fundScore.profitability,
            health: fundScore.health,
            cashFlow: fundScore.cashFlow,
            analyst: fundScore.analyst,
            signals: fundScore.signals,
            warnings: fundScore.warnings,
          };
          
          result.dividendYield = analysis.dividend.dividendYield;

          if (preset === 'HIGH_YIELD_DIVIDEND') {
            const yieldPct = analysis.dividend.dividendYield ?? 0;
            const fundTotal = fundScore.total;
            
            // Calculate 52-week high and discount
            const high52Week = Math.max(...history.map(h => h.high));
            const currentPrice = history[history.length - 1].close;
            const priceDiscount = high52Week > 0 ? ((high52Week - currentPrice) / high52Week) * 100 : 0;
            result.priceDiscountFromPeak = priceDiscount;
            
            const yieldReq = yieldPct >= 5.0;
            taPass = yieldReq; // Only filter by yield!
            
            // Update the placeholders created earlier
            const yieldItem = criteria.find(c => c.label === 'Dividend Yield');
            if (yieldItem) { yieldItem.passed = yieldReq; yieldItem.value = `${yieldPct.toFixed(2)}%`; }
            const fundItem = criteria.find(c => c.label === 'Fundamental Score');
            if (fundItem) { fundItem.passed = true; fundItem.value = `${fundTotal}`; } // Used for sorting only
            const discItem = criteria.find(c => c.label === 'Discount from Peak');
            if (discItem) { discItem.passed = true; discItem.value = `-${priceDiscount.toFixed(1)}%`; } // Used for sorting only
            
            if (taPass) {
              signals.push('High Yield Screen Passed');
            } else {
              signals.push(`Failed High Yield Requirement (${yieldPct.toFixed(2)}% < 5.0%)`);
            }
          }

          // ── Analyst Consensus ──
          result.analystUpside = fundScore.analystUpside;
          result.analystConsensus = fundScore.analystConsensus;
          result.analystTargetPrice = analysis.analystRating.targetMeanPrice;

          // ── Short Interest (for SHORT_SQUEEZE gate + display) ──
          const si = analysis.shortInterest;
          result.shortInterestPct = si.shortPercentOfFloat;
          result.shortRatioDays = si.shortRatio;

          // Apply actual short interest gate to SHORT_SQUEEZE preset AFTER fundamentals are loaded
          if (preset === 'SHORT_SQUEEZE' && taPass) {
            const hasHighShortInterest = si.shortPercentOfFloat != null && si.shortPercentOfFloat >= 10;
            if (!hasHighShortInterest) {
              taPass = false;
              // Don't add a blocking signal — just silently fail the preset
              // (short interest data may be missing for IDX stocks)
              if (si.shortPercentOfFloat != null) {
                signals.push(`Short interest too low (${si.shortPercentOfFloat.toFixed(1)}% of float)`);
              }
            } else {
              signals.push(`High short interest (${si.shortPercentOfFloat!.toFixed(1)}% of float)`);
            }
          }

          // ── EPS Revision ──
          const eps = analysis.epsRevision;
          result.epsRevisionUp = eps.epsRevisionUp;
          if (eps.epsRevisionUp === true && eps.revisionPercent != null) {
            signals.push(`EPS estimate revised up (+${eps.revisionPercent.toFixed(1)}% vs 30d ago)`);
          } else if (eps.epsRevisionUp === false) {
            // Negative revision — note it but don't block
          }

          // ── Earnings Calendar ──
          const ec = analysis.earningsCalendar;
          result.daysToEarnings = ec.daysToEarnings;
          result.earningsDate = ec.nextEarningsDate;

          // ── 52-Week Relative Strength Signal ──
          if (analysis.relativeStrength52W != null && analysis.relativeStrength52W >= 15) {
            signals.push(`Outperforming market by ${analysis.relativeStrength52W.toFixed(1)}pp (52W)`);
          }

          // ── Analyst Upgrade Activity ──
          const ud = analysis.upgradeDowngrades;
          if (ud.upgradeCount30d >= 2 && ud.netScore >= 2) {
            signals.push(`${ud.upgradeCount30d} analyst upgrades in last 30 days`);
          }

          // ── Sector ──
          result.sector = analysis.profile.sector || null;

          // ── Insider Activity ──
          if (analysis.insiderActivity) {
            result.insiderActivity = {
              netSharesBought90d: analysis.insiderActivity.netSharesBought90d,
              buyShares90d: analysis.insiderActivity.buyShares90d,
              sellShares90d: analysis.insiderActivity.sellShares90d,
            };
          } else {
            result.insiderActivity = null;
          }

          // ── 52W Low & Fib Levels ──
          result.fiftyTwoWeekLow = analysis.fiftyTwoWeekLow || null;
          result.fibonacciLevels = analysis.fibonacciLevels || null;

          // ── 52W Relative Strength ──
          result.relativeStrength52W = analysis.relativeStrength52W || null;
          result.stock52WChange = analysis.stock52WChange || null;
        }
      } catch (err: any) {
        console.warn(`[Screener] Failed to fetch fundamentals/red flags for ${cleanSymbol}: ${err.message}`);
        if (preset === 'HIGH_YIELD_DIVIDEND') {
          taPass = false; // Fail the screen if fundamentals (dividend data) fail to load
        }
      }
    }

    result.signals = signals;
    result.presetCriteria = criteria;
    result.isPass = taPass;

    return result;
  } catch (err: any) {
    result.error = err.message;
    return result;
  }
}
