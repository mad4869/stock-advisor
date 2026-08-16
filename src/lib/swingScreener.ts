import { yf, getComprehensiveAnalysis2 } from './yahooFinance2';
import { calculateTA, TAData } from './technicalIndicators';
import { PresetCriterion } from '@/types';
import { historyCache, singleScreenerCache, CACHE_TTL } from './cache';
import { Market, SwingScreenerResult } from '@/types';
import { detectRedFlags } from './redFlags';
import { computeFundamentalScore } from './fundamentalScorer';

export type Preset = 'DEFAULT' | 'BREAKOUT' | 'EARLY_BREAKOUT' | 'OVERSOLD' | 'VOLUME_CLIMAX' | 'SHORT_SQUEEZE' | 'MA_TREND' | 'TA_ONLY' | 'BULL_DIV' | 'VOL_SPIKE' | 'DEFENSIVE' | 'DETAIL' | 'HIGH_YIELD_DIVIDEND';

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
    signals: [],
    presetCriteria: [],

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
    
    

    // Early exit: if not accumulating, skip full TA computation.
    // This is both architecturally correct (follow smart money first)
    // and a performance optimization for large universes.
    // Exception: TA_ONLY, DETAIL, and HIGH_YIELD_DIVIDEND presets ignore the smart money gate entirely.
    

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

    // Absolute volume floor check — skipped for DETAIL, HIGH_YIELD_DIVIDEND, and MULTI_BAGGER presets
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
    // Individual breakdown items: { label, category, points, max, passed }
    const taScoreItems: { label: string; category: 'trend' | 'volume' | 'momentum' | 'structure'; points: number; max: number; passed: boolean }[] = [];

    

    // Trend
    const price = ta.close;
    const t1 = ta.ema20 && price > ta.ema20;
    if (t1) trendScore += 10;
    taScoreItems.push({ label: 'Price > EMA20', category: 'trend', points: t1 ? 10 : 0, max: 10, passed: !!t1 });

    const t2 = ta.ema50 && ta.ema20 && ta.ema20 > ta.ema50;
    if (t2) trendScore += 10;
    taScoreItems.push({ label: 'EMA20 > EMA50 (Short-term uptrend)', category: 'trend', points: t2 ? 10 : 0, max: 10, passed: !!t2 });

    const t3 = ta.ema200 && ta.ema50 && ta.ema50 > ta.ema200;
    if (t3) trendScore += 5;
    taScoreItems.push({ label: 'EMA50 > EMA200 (Long-term uptrend)', category: 'trend', points: t3 ? 5 : 0, max: 5, passed: !!t3 });

    if (ta.supertrendBullish) {
      trendScore += 5;
      signals.push('Supertrend Bullish');
    }
    taScoreItems.push({ label: 'Supertrend Bullish', category: 'trend', points: ta.supertrendBullish ? 5 : 0, max: 5, passed: !!ta.supertrendBullish });

    // Trend Crossover Recency Weighting (Bonuses)
    let crossoverPoints = 0;
    let crossoverLabel = 'No recent crossovers';
    if (ta.emaCrossoverRecency !== null && ta.emaCrossoverRecency <= 10) {
      const bonus = ta.emaCrossoverRecency <= 5 ? 5 : 3;
      trendScore += bonus;
      crossoverPoints += bonus;
      crossoverLabel = `Golden Cross ${ta.emaCrossoverRecency}d ago`;
      signals.push(`Recent Golden Cross (${ta.emaCrossoverRecency}d ago)`);
    }
    if (ta.macdCrossoverRecency !== null && ta.macdCrossoverRecency <= 10) {
      const bonus = ta.macdCrossoverRecency <= 5 ? 5 : 3;
      trendScore += bonus;
      crossoverPoints += bonus;
      crossoverLabel += crossoverLabel === 'No recent crossovers' ? `MACD Cross ${ta.macdCrossoverRecency}d ago` : ` + MACD Cross ${ta.macdCrossoverRecency}d ago`;
      signals.push(`Recent MACD Bullish Cross (${ta.macdCrossoverRecency}d ago)`);
    }
    if (ta.priceCrossoverRecency !== null && ta.priceCrossoverRecency <= 5) {
      trendScore += 3;
      crossoverPoints += 3;
      crossoverLabel += crossoverLabel === 'No recent crossovers' ? `Price/EMA20 Cross ${ta.priceCrossoverRecency}d ago` : ` + Price/EMA20 ${ta.priceCrossoverRecency}d ago`;
      signals.push(`Recent Price EMA20 Cross (${ta.priceCrossoverRecency}d ago)`);
    }
    taScoreItems.push({ label: `Recent Crossovers (${crossoverLabel})`, category: 'trend', points: crossoverPoints, max: 13, passed: crossoverPoints > 0 });

    // MA Proximity & Pullbacks (in trend section)
    const dist20 = ta.distFromEMA20;
    const dist50 = ta.distFromEMA50;
    const dist200 = ta.distFromEMA200;

    // Rule 5: Avoid stocks below all MAs (Massive Penalty)
    let belowAllMas = false;
    if (dist20 != null && dist50 != null && dist200 != null) {
      if (dist20 < 0 && dist50 < 0 && dist200 < 0) {
        trendScore -= 15;
        belowAllMas = true;
        signals.push('Below All Major MAs (Downtrend)');
      }
    }
    if (belowAllMas) {
      taScoreItems.push({ label: 'Below all major MAs (penalty)', category: 'trend', points: -15, max: 0, passed: false });
    }

    // Rule 2: Enter stocks near MA (Pullback Bonus)
    const isUptrend = ta.ema20 && ta.ema50 && ta.ema20 > ta.ema50;
    let pullbackPoints = 0;
    let pullbackLabel = 'No pullback detected';
    if (isUptrend) {
      if (dist20 !== null && dist20 >= 0 && dist20 <= 3.5) {
        trendScore += 5;
        pullbackPoints = 5;
        pullbackLabel = `Pullback to EMA20 (+${dist20.toFixed(1)}%)`;
        signals.push(`Perfect Pullback to EMA20 (+${dist20.toFixed(1)}%)`);
      } else if (dist50 !== null && dist50 >= 0 && dist50 <= 3.5) {
        trendScore += 5;
        pullbackPoints = 5;
        pullbackLabel = `Pullback to EMA50 (+${dist50.toFixed(1)}%)`;
        signals.push(`Perfect Pullback to EMA50 (+${dist50.toFixed(1)}%)`);
      }
    }
    if (pullbackPoints > 0) {
      taScoreItems.push({ label: `MA Pullback Bonus (${pullbackLabel})`, category: 'trend', points: pullbackPoints, max: 5, passed: true });
    }

    // Rule 1: Overextended Penalty
    let overextPoints = 0;
    let overextLabel = 'Not overextended';
    if (dist20 !== null && dist20 > 20) {
      trendScore -= 5;
      overextPoints = -5;
      overextLabel = `+${dist20.toFixed(1)}% from EMA20`;
      signals.push(`Overextended (+${dist20.toFixed(1)}% from EMA20)`);
    } else if (dist50 !== null && dist50 > 30) {
      trendScore -= 5;
      overextPoints = -5;
      overextLabel = `+${dist50.toFixed(1)}% from EMA50`;
      signals.push(`Overextended (+${dist50.toFixed(1)}% from EMA50)`);
    }
    if (overextPoints < 0) {
      taScoreItems.push({ label: `Overextended penalty (${overextLabel})`, category: 'trend', points: overextPoints, max: 0, passed: false });
    }

    // Volume
    let volRatioPoints = 0;
    let volRatioLabel = 'No data';
    if (ta.volumeRatio) {
      if (ta.volumeRatio >= config.volumeRatioSurge) {
        volScore += 15; volRatioPoints = 15; volRatioLabel = `${ta.volumeRatio.toFixed(1)}x avg (Surge)`;
        signals.push('Volume Surge');
      } else if (ta.volumeRatio >= config.volumeRatioBullish) {
        volScore += 10; volRatioPoints = 10; volRatioLabel = `${ta.volumeRatio.toFixed(1)}x avg (Bullish)`;
      } else if (ta.volumeRatio >= 1.0) {
        volScore += 5; volRatioPoints = 5; volRatioLabel = `${ta.volumeRatio.toFixed(1)}x avg (Moderate)`;
      } else {
        volRatioLabel = `${ta.volumeRatio.toFixed(1)}x avg (Weak)`;
      }
    }
    taScoreItems.push({ label: `Volume Ratio (${volRatioLabel})`, category: 'volume', points: volRatioPoints, max: 15, passed: volRatioPoints > 0 });

    const v2 = ta.obvTrendPositive;
    if (v2) volScore += 10;
    taScoreItems.push({ label: 'OBV Trend Positive', category: 'volume', points: v2 ? 10 : 0, max: 10, passed: !!v2 });

    const v3 = ta.mfi && ta.mfi > 50;
    if (v3) volScore += 5;
    taScoreItems.push({ label: `MFI > 50 (${ta.mfi?.toFixed(1) ?? '—'})`, category: 'volume', points: v3 ? 5 : 0, max: 5, passed: !!v3 });

    // Momentum — RSI
    let rsiPoints = 0;
    let rsiLabel = 'N/A';
    if (ta.rsi) {
      const rsiVal = ta.rsi;
      const overbought = config.rsiOverbought;
      const midHigh = overbought - 5;
      const upperLimit = overbought + 10;
      let rsiScore = 0;
      if (rsiVal < 30) {
        rsiScore = 0; rsiLabel = `${rsiVal.toFixed(1)} (Oversold/Weak)`;
        signals.push('RSI Weak');
      } else if (rsiVal < 45) {
        rsiScore = ((rsiVal - 30) / 15) * 10;
        rsiLabel = `${rsiVal.toFixed(1)} (Building)`;
        if (rsiVal < 40) signals.push('RSI Weak');
      } else if (rsiVal <= midHigh) {
        rsiScore = 10; rsiLabel = `${rsiVal.toFixed(1)} (Bullish zone)`;
      } else if (rsiVal <= overbought) {
        const ratio = (rsiVal - midHigh) / (overbought - midHigh);
        rsiScore = 10 - ratio * 5;
        rsiLabel = `${rsiVal.toFixed(1)} (Extended)`;
        signals.push('RSI Extended');
      } else if (rsiVal <= upperLimit) {
        const ratio = (rsiVal - overbought) / (upperLimit - overbought);
        rsiScore = 5 - ratio * 5;
        rsiLabel = `${rsiVal.toFixed(1)} (Overbought)`;
        signals.push('RSI Overbought');
      } else {
        rsiScore = 0; rsiLabel = `${rsiVal.toFixed(1)} (Extreme OB)`;
        signals.push('RSI Overbought');
      }
      momScore += rsiScore;
      rsiPoints = rsiScore;
    }
    taScoreItems.push({ label: `RSI (${rsiLabel})`, category: 'momentum', points: Math.round(rsiPoints), max: 10, passed: rsiPoints > 5 });

    let stochPoints = 0;
    let stochLabel = 'No signal';
    if (ta.stochRecovery) {
      momScore += 10; stochPoints = 10; stochLabel = 'Oversold Recovery';
      signals.push('Stochastic Oversold Recovery');
    } else if (ta.stochK && ta.stochD && ta.stochK > ta.stochD) {
      momScore += 5; stochPoints = 5; stochLabel = 'K > D (Bullish)';
    } else {
      stochLabel = 'Bearish / Neutral';
    }
    taScoreItems.push({ label: `Stochastic (${stochLabel})`, category: 'momentum', points: stochPoints, max: 10, passed: stochPoints > 0 });

    const m3 = ta.cci && ta.cci > 0;
    if (m3) momScore += 5;
    taScoreItems.push({ label: `CCI > 0 (${ta.cci?.toFixed(1) ?? '—'})`, category: 'momentum', points: m3 ? 5 : 0, max: 5, passed: !!m3 });

    // Structure
    const s1 = ta.atrPercent && ta.atrPercent >= config.minAtrPercent && ta.atrPercent <= config.maxAtrPercent;
    if (s1) structScore += 5;
    taScoreItems.push({ label: `ATR% in range (${ta.atrPercent?.toFixed(1) ?? '—'}%)`, category: 'structure', points: s1 ? 5 : 0, max: 5, passed: !!s1 });

    const s2 = ta.bollingerB && ta.bollingerB > 0.4 && ta.bollingerB < 0.9;
    if (s2) structScore += 5;
    taScoreItems.push({ label: `Bollinger %B mid-zone (${ta.bollingerB?.toFixed(2) ?? '—'})`, category: 'structure', points: s2 ? 5 : 0, max: 5, passed: !!s2 });

    const s3 = ta.distanceTo52wHigh && ta.distanceTo52wHigh > 0.03;
    if (s3) structScore += 2;
    taScoreItems.push({ label: `Room to 52w High (${ta.distanceTo52wHigh != null ? `${(ta.distanceTo52wHigh * 100).toFixed(1)}% away` : '—'})`, category: 'structure', points: s3 ? 2 : 0, max: 2, passed: !!s3 });

    const s4 = ta.distanceToS1 && ta.distanceToS1 >= 0 && ta.distanceToS1 <= 0.05;
    if (s4) {
      structScore += 3;
      signals.push('Near Pivot Support');
    }
    taScoreItems.push({ label: `Near Pivot S1 (${ta.distanceToS1 != null ? `${(ta.distanceToS1 * 100).toFixed(1)}% from S1` : '—'})`, category: 'structure', points: s4 ? 3 : 0, max: 3, passed: !!s4 });

    const totalTaScore = Math.min(100, Math.max(0, Math.round(trendScore + volScore + momScore + structScore)));
    result.taScore = totalTaScore;
    result.taScoreBreakdown = {
      trend: Math.round(trendScore),
      volume: Math.round(volScore),
      momentum: Math.round(momScore),
      structure: Math.round(structScore)
    };
    result.taScoreItems = taScoreItems;

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
      // Breakout technical setup
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const adxReq = ta.adx ? ta.adx > 25 : false;
      const bbReq = ta.bollingerB ? ta.bollingerB > 0.8 : false;
      taPass = taPass && volReq && adxReq && bbReq;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'Volume Spike', value: `${ta.volumeRatio?.toFixed(1) ?? '—'}x`, threshold: '≥ 3.0x', passed: volReq },
        { label: 'ADX (Trend Strength)', value: ta.adx?.toFixed(1) ?? '—', threshold: '> 25', passed: adxReq },
        { label: 'Bollinger %B', value: ta.bollingerB?.toFixed(2) ?? '—', threshold: '> 0.80', passed: bbReq },
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
      );
      if (taPass) signals.push('Early Breakout Setup');
    }
    else if (preset === 'OVERSOLD') {
      // Stochastic or MACD Golden Cross from Oversold — the cleanest single-reason entries.
      // EITHER:
      //   - Stoch: K crosses above D while K was below 20 on the previous bar.
      //   - MACD: MACD crosses above Signal while MACD was below 0 on the previous bar.
      // No other reason needed — this is the signal as traders use it.
      //
      // Requirements:
      //   1. Stoch GC from < 20 OR MACD GC from < 0
      //   2. RSI not already overbought (≤ 70)
      //   3. Price not crashing (10d change > -5%)

      const stochGcReq = ta.stochRecovery;
      const macdGcReq = ta.macdCrossFromBelowZero;
      const rsiNotOB = ta.rsi != null ? ta.rsi <= 70 : true;
      const notCrashing = priceChange10d != null ? priceChange10d > -0.05 : true;

      taPass = (stochGcReq || macdGcReq) && rsiNotOB && notCrashing;
      criteria.push(
        { label: 'Stoch GC (< 20) OR MACD GC (< 0)', value: (stochGcReq && macdGcReq) ? 'Both (Stoch + MACD)' : (stochGcReq ? 'Stoch GC' : (macdGcReq ? 'MACD GC' : 'None')), threshold: 'Fresh Cross', passed: stochGcReq || macdGcReq },
        { label: 'RSI (Not Overbought)', value: ta.rsi?.toFixed(1) ?? '—', threshold: '≤ 70', passed: rsiNotOB },
        { label: 'Price Not Crashing', value: priceChange10d != null ? `${(priceChange10d * 100).toFixed(1)}%` : '—', threshold: '> -5% (10d)', passed: notCrashing },
      );
      if (taPass) {
        if (stochGcReq) signals.push('Stoch Golden Cross from Oversold Zone');
        if (macdGcReq) signals.push('MACD Golden Cross from Below Zero');
        if (ta.macdIncreasing && !macdGcReq) signals.push('MACD Histogram Rising (Confirms)');
      }
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
      const isOverextended = ta.distFromEMA20 != null && ta.distFromEMA20 > 20;
      taPass = taPass && allMaAbove && !isOverextended;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 50', passed: totalTaScore >= 50 },
        { label: 'Price vs EMA20', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema20 ? fmt(ta.ema20, isId) : '—'}`, passed: aboveEma20 },
        { label: 'Price vs EMA50', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema50 ? fmt(ta.ema50, isId) : '—'}`, passed: aboveEma50 },
        { label: 'Price vs EMA200', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.ema200 ? fmt(ta.ema200, isId) : '—'}`, passed: aboveEma200 },
        { label: 'Price vs SMA20', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.sma20 ? fmt(ta.sma20, isId) : '—'}`, passed: aboveSma20 },
        { label: 'Price vs SMA50', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.sma50 ? fmt(ta.sma50, isId) : '—'}`, passed: aboveSma50 },
        { label: 'Price vs SMA200', value: `${cur}${fmt(price, isId)}`, threshold: `> ${cur}${ta.sma200 ? fmt(ta.sma200, isId) : '—'}`, passed: aboveSma200 },
        { label: 'MA Proximity', value: ta.distFromEMA20 != null ? `+${ta.distFromEMA20.toFixed(1)}%` : '—', threshold: '≤ +20% (Not Extended)', passed: !isOverextended },
      );
      if (taPass) signals.push('Above All MAs (EMA & SMA)');
      if (isOverextended) signals.push('Rejected: Price too extended from EMA20');
    }
    else if (preset === 'BULL_DIV') {
      // RSI Bullish Divergence + Lower Bollinger Band — classic mean reversion setup.
      // The stock must be statistically "too cheap" (near lower BB) while momentum
      // is diverging bullishly — sellers are exhausted and price should revert to mean.
      //
      // Requirements:
      //   1. Price near lower Bollinger Band (%B ≤ 0.25, i.e. below or near lower band)
      //   2. RSI divergence detected (lower price low + higher RSI low)
      //   3. RSI in the sweet spot: not crashed (≥30), not already recovered (≤62)
      //   4. Stochastic recovering OR MACD histogram increasing (momentum starting to turn)
      //   5. Some smart money absorption (acc score ≥40 — 2/5 signals)

      const lowerBBReq = ta.bollingerB != null ? ta.bollingerB <= 0.35 : false;
      const divDetected = ta.rsiDivergence;
      const rsiInRange = ta.rsi != null ? ta.rsi >= 25 && ta.rsi <= 65 : false;
      const momentumTurning = ta.stochRecovery || ta.macdIncreasing;

      taPass = lowerBBReq && divDetected && rsiInRange && momentumTurning;
      criteria.push(
        { label: 'Near Lower Bollinger Band', value: ta.bollingerB != null ? `%B ${ta.bollingerB.toFixed(2)}` : '—', threshold: '≤ 0.35', passed: lowerBBReq },
        { label: 'RSI Divergence', value: divDetected ? 'Detected' : 'None', threshold: 'Price LL + RSI HL', passed: divDetected },
        { label: 'RSI (Sweet Spot)', value: ta.rsi?.toFixed(1) ?? '—', threshold: '25–65', passed: rsiInRange },
        { label: 'Momentum Turning', value: ta.stochRecovery ? 'Stoch Recovery' : ta.macdIncreasing ? 'MACD Rising' : 'No', threshold: 'Stoch or MACD', passed: momentumTurning },
      );
      if (taPass) {
        signals.push('Mean Reversion: Lower BB + RSI Divergence');
        if (ta.stochRecovery) signals.push('Stochastic Oversold Recovery');
        if (ta.macdIncreasing) signals.push('MACD Histogram Rising');
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
      );
      if (taPass) signals.push(`Volume Spike (${ta.volumeRatio?.toFixed(1)}x avg)`);
    }
    else if (preset === 'DEFENSIVE') {
      // Crash-Resistant / Defensive Screener.
      // Finds fundamentally stable, low-volatility stocks that tend to hold up
      // during market corrections because of:
      //   1. Low beta (< 0.8)  — moves less than the market
      //   2. Low daily volatility (ATR% < 3.0%)  — stable price action
      //   3. Healthy balance sheet (D/E ≤ 1.5)  — not fragile in a credit crunch
      //   4. Liquid (current ratio ≥ 1.2)  — can survive without external financing
      //   5. Profitable (ROE ≥ 8%)  — not a cash-burning story stock
      //   6. Above EMA200  — still in a long-term uptrend (not already in freefall)
      // Fundamentals are loaded in the post-TA phase below.
      taPass = true; // defer final pass/fail until fundamentals are loaded
      criteria.push(
        { label: 'Beta (Low Volatility)', value: '—', threshold: '0.1–0.75', passed: false },
        { label: 'ATR% (Daily Swing)', value: ta.atrPercent != null ? `${ta.atrPercent.toFixed(1)}%` : '—', threshold: '< 2.5%', passed: (ta.atrPercent ?? 99) < 2.5 },
        { label: 'Above EMA200 (Trend)', value: ta.ema200 != null ? (ta.close > ta.ema200 ? 'Yes' : 'No') : '—', threshold: 'Price > EMA200', passed: ta.ema200 != null && ta.close > ta.ema200 },
        { label: 'D/E Ratio', value: '—', threshold: '≤ 1.0', passed: false },
        { label: 'Current Ratio', value: '—', threshold: '≥ 1.5', passed: false },
        { label: 'ROE', value: '—', threshold: '≥ 10%', passed: false },
      );
      if (taPass) signals.push('Screening for Crash-Resistant / Defensive Stock...');
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
      taPass = true; // Bypass TA gates
      criteria.push(
        { label: 'Dividend Yield', value: 'Fetching...', threshold: '≥ 5.0%', passed: false },
        { label: 'Fundamental Score', value: 'Fetching...', threshold: 'For Sorting', passed: true },
        { label: 'Discount from Peak', value: 'Fetching...', threshold: 'For Sorting', passed: true },
      );
      if (taPass) signals.push('Evaluating Yield & Fundamentals...');
    }

    else {
      // DEFAULT: just TA score gates, no extra criteria
      const isOverextended = ta.distFromEMA20 != null && ta.distFromEMA20 > 20;
      taPass = taPass && !isOverextended;
      criteria.push(
        { label: 'TA Score', value: `${totalTaScore}`, threshold: '≥ 60', passed: totalTaScore >= 60 },
        { label: 'MA Proximity', value: ta.distFromEMA20 != null ? `+${ta.distFromEMA20.toFixed(1)}%` : '—', threshold: '≤ +20% (Not Extended)', passed: !isOverextended },
      );
      if (isOverextended) signals.push('Rejected: Price too extended from EMA20');
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
          result.beta = analysis.fundamentals.beta;
          result.dividendFrequencyLabel = analysis.dividend.dividendFrequencyLabel;

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

          if (preset === 'DEFENSIVE') {
            const f = analysis.fundamentals;
            const beta = f.beta;
            const de = f.debtToEquity;
            const cr = f.currentRatio;
            const roe = f.roe;
            const divYield = analysis.dividend.dividendYield ?? f.dividendYield ?? 0;

            // Hard gates: both must pass — these define a defensive stock
            // Positive beta 0.1–0.8: negative = data artifact, >0.8 = too volatile
            const betaOk = beta != null ? beta >= 0.1 && beta < 0.8 : false;
            // Dividend yield: must reward holders for staying through market downturns
            const minDivYield = market === 'ID' ? 2.5 : 1.5; // IDX tends to pay higher yields
            const divOk = divYield >= minDivYield;

            // Supporting criteria: 3 out of 5 must pass
            const atrOk = (ta.atrPercent ?? 99) < 2.5;
            const ema200Ok = ta.ema200 != null && ta.close > ta.ema200;
            const deOk = de != null ? de <= 1.2 : false;
            const crOk = cr != null ? cr >= 1.3 : false;
            const roeOk = roe != null ? roe >= 8 : false;

            const otherGates = [atrOk, ema200Ok, deOk, crOk, roeOk];
            const otherPassed = otherGates.filter(Boolean).length;
            taPass = betaOk && divOk && otherPassed >= 3;

            // Update placeholders
            const betaItem = criteria.find(c => c.label === 'Beta (Low Volatility)');
            if (betaItem) { betaItem.passed = betaOk; betaItem.value = beta != null ? beta.toFixed(2) : '—'; betaItem.threshold = '0.1–0.8'; }
            const divItem = criteria.find(c => c.label === 'Dividend Yield');
            if (divItem) { divItem.passed = divOk; divItem.value = `${divYield.toFixed(2)}%`; divItem.threshold = `≥ ${minDivYield}%`; }
            const atrItem = criteria.find(c => c.label === 'ATR% (Daily Swing)');
            if (atrItem) { atrItem.passed = atrOk; }
            const deItem = criteria.find(c => c.label === 'D/E Ratio');
            if (deItem) { deItem.passed = deOk; deItem.value = de != null ? `${de.toFixed(2)}x` : '—'; }
            const crItem = criteria.find(c => c.label === 'Current Ratio');
            if (crItem) { crItem.passed = crOk; crItem.value = cr != null ? `${cr.toFixed(2)}x` : '—'; }
            const roeItem = criteria.find(c => c.label === 'ROE');
            if (roeItem) { roeItem.passed = roeOk; roeItem.value = roe != null ? `${roe.toFixed(1)}%` : '—'; }

            if (taPass) {
              signals.length = 0;
              signals.push(`Defensive: Low Beta + Dividend ${divYield.toFixed(2)}%`);
              if (beta != null) signals.push(`Low Market Sensitivity (Beta ${beta.toFixed(2)})`);
              if (ema200Ok) signals.push('Trading Above EMA200 (Long-Term Uptrend)');
              if (roeOk && roe != null) signals.push(`Profitable Business (ROE ${roe.toFixed(1)}%)`);
            }
          }


          if (preset === 'DEFAULT') {
            const f = analysis.fundamentals;
            
            // 1. Valuation Guardrail (Optional)
            if (f.peRatio != null && f.peRatio > 30) {
              taPass = false;
              signals.push(`Blocked: Overvalued (P/E ${f.peRatio.toFixed(1)}x > 30)`);
            } else if (f.peRatio == null && f.psRatio != null && f.psRatio > 5) {
              taPass = false;
              signals.push(`Blocked: Overvalued (P/S ${f.psRatio.toFixed(1)}x > 5)`);
            } else {
              // Add to criteria if it passed and exists
              if (f.peRatio != null) {
                criteria.push({ label: 'Valuation (P/E)', value: `${f.peRatio.toFixed(1)}x`, threshold: '≤ 30', passed: true });
              } else if (f.psRatio != null) {
                criteria.push({ label: 'Valuation (P/S)', value: `${f.psRatio.toFixed(1)}x`, threshold: '≤ 5', passed: true });
              }
            }

            // 2. Cash Flow Guardrail (Optional)
            if (f.freeCashFlow != null && f.freeCashFlow <= 0) {
              taPass = false;
              signals.push(`Blocked: Negative Free Cash Flow`);
            } else if (f.freeCashFlow != null) {
              criteria.push({ label: 'Free Cash Flow', value: '+ Pos', threshold: '> 0', passed: true });
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
        if (preset === 'HIGH_YIELD_DIVIDEND' || preset === 'DEFENSIVE') {
          taPass = false; // Fail if fundamentals can't load — these presets rely on fundamental data
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
