import { TechnicalIndicators, Signal, IndicatorSignal, StockQuote, StockRecommendation } from '@/types';

function getSignalScore(signal: Signal): number {
  switch (signal) {
    case 'STRONG_BUY': return 2;
    case 'BUY': return 1;
    case 'HOLD': return 0;
    case 'SELL': return -1;
    case 'STRONG_SELL': return -2;
  }
}

function scoreToSignal(score: number): Signal {
  if (score >= 1.2) return 'STRONG_BUY';
  if (score >= 0.4) return 'BUY';
  if (score >= -0.4) return 'HOLD';
  if (score >= -1.2) return 'SELL';
  return 'STRONG_SELL';
}

export function analyzeStock(
  quote: StockQuote,
  indicators: TechnicalIndicators
): StockRecommendation {
  const signals: IndicatorSignal[] = [];

  // 1. RSI Analysis
  if (indicators.rsi !== null) {
    let signal: Signal;
    let explanation: string;
    if (indicators.rsi < 20) {
      signal = 'STRONG_BUY';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, which is deeply oversold. This often precedes a price bounce.`;
    } else if (indicators.rsi < 30) {
      signal = 'BUY';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, entering oversold territory. The stock may be undervalued.`;
    } else if (indicators.rsi < 45) {
      signal = 'BUY';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, below the midpoint suggesting room for upward movement.`;
    } else if (indicators.rsi <= 55) {
      signal = 'HOLD';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, near the neutral zone. No strong momentum either way.`;
    } else if (indicators.rsi <= 70) {
      signal = 'HOLD';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, above midpoint but not yet overbought.`;
    } else if (indicators.rsi <= 80) {
      signal = 'SELL';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, in overbought territory. Consider taking profits.`;
    } else {
      signal = 'STRONG_SELL';
      explanation = `RSI is at ${indicators.rsi.toFixed(1)}, extremely overbought. High risk of a pullback.`;
    }

    signals.push({
      name: 'RSI (Relative Strength Index)',
      value: indicators.rsi.toFixed(1),
      signal,
      explanation,
      educationalInfo:
        'RSI measures the speed and magnitude of price changes on a scale of 0-100. Below 30 is considered oversold (potential buy), above 70 is overbought (potential sell). It helps identify when a stock has moved too far, too fast in one direction.',
    });
  }

  // 2. MACD Analysis
  if (indicators.macd) {
    const { MACD: macdLine, signal: signalLine, histogram } = indicators.macd;
    let signal: Signal;
    let explanation: string;

    if (macdLine > signalLine && histogram > 0) {
      if (histogram > Math.abs(macdLine) * 0.1) {
        signal = 'STRONG_BUY';
        explanation = `MACD (${macdLine.toFixed(2)}) is well above the signal line (${signalLine.toFixed(2)}) with a strong positive histogram. Bullish momentum is accelerating.`;
      } else {
        signal = 'BUY';
        explanation = `MACD (${macdLine.toFixed(2)}) is above the signal line (${signalLine.toFixed(2)}). A bullish crossover indicates upward momentum.`;
      }
    } else if (macdLine < signalLine && histogram < 0) {
      if (Math.abs(histogram) > Math.abs(macdLine) * 0.1) {
        signal = 'STRONG_SELL';
        explanation = `MACD (${macdLine.toFixed(2)}) is well below the signal line (${signalLine.toFixed(2)}) with a strong negative histogram. Bearish momentum is accelerating.`;
      } else {
        signal = 'SELL';
        explanation = `MACD (${macdLine.toFixed(2)}) is below the signal line (${signalLine.toFixed(2)}). A bearish crossover indicates downward momentum.`;
      }
    } else {
      signal = 'HOLD';
      explanation = `MACD and signal lines are converging. The trend is uncertain — wait for a clear crossover.`;
    }

    signals.push({
      name: 'MACD (Moving Average Convergence Divergence)',
      value: `${macdLine.toFixed(2)} / ${signalLine.toFixed(2)}`,
      signal,
      explanation,
      educationalInfo:
        'MACD shows the relationship between two exponential moving averages (12 & 26 period). When the MACD line crosses above the signal line, it\'s a bullish signal. When it crosses below, it\'s bearish. The histogram shows the distance between the two lines — larger bars mean stronger momentum.',
    });
  }

  // 3. Moving Average Analysis (SMA 20/50/200)
  if (indicators.sma20 && indicators.sma50) {
    const price = quote.price;
    let signal: Signal;
    let explanation: string;

    const aboveSMA20 = price > indicators.sma20;
    const aboveSMA50 = price > indicators.sma50;
    const aboveSMA200 = indicators.sma200 ? price > indicators.sma200 : null;
    const goldenCross = indicators.sma50 > (indicators.sma200 || 0);

    if (aboveSMA20 && aboveSMA50 && aboveSMA200) {
      signal = 'STRONG_BUY';
      explanation = `Price ($${price}) is above all major moving averages (SMA20: $${indicators.sma20.toFixed(2)}, SMA50: $${indicators.sma50.toFixed(2)}, SMA200: $${indicators.sma200?.toFixed(2)}). Strong uptrend confirmed.`;
    } else if (aboveSMA20 && aboveSMA50) {
      signal = 'BUY';
      explanation = `Price is above the 20 and 50-day SMAs. Short and medium-term trends are bullish.`;
    } else if (!aboveSMA20 && !aboveSMA50 && aboveSMA200 === false) {
      signal = 'STRONG_SELL';
      explanation = `Price is below all major moving averages. Strong downtrend in progress.`;
    } else if (!aboveSMA20 && !aboveSMA50) {
      signal = 'SELL';
      explanation = `Price is below the 20 and 50-day SMAs. Short and medium-term trends are bearish.`;
    } else {
      signal = 'HOLD';
      explanation = `Mixed signals from moving averages. Price is between key levels.`;
    }

    signals.push({
      name: 'Moving Averages (SMA 20/50/200)',
      value: `Price vs SMA20: ${aboveSMA20 ? 'Above' : 'Below'}, SMA50: ${aboveSMA50 ? 'Above' : 'Below'}`,
      signal,
      explanation,
      educationalInfo:
        'Simple Moving Averages (SMA) smooth out price data to show the trend direction. SMA20 shows the short-term trend, SMA50 the medium-term, and SMA200 the long-term. When the price is above an SMA, the trend is considered bullish for that timeframe. A "Golden Cross" (SMA50 crossing above SMA200) is a strong bullish signal.',
    });
  }

  // 4. Bollinger Bands Analysis
  if (indicators.bollingerBands) {
    const { upper, middle, lower } = indicators.bollingerBands;
    const price = quote.price;
    const bandWidth = ((upper - lower) / middle) * 100;
    let signal: Signal;
    let explanation: string;

    if (price <= lower) {
      signal = 'BUY';
      explanation = `Price ($${price}) is at or below the lower Bollinger Band ($${lower.toFixed(2)}). The stock may be oversold and could bounce back to the mean.`;
    } else if (price >= upper) {
      signal = 'SELL';
      explanation = `Price ($${price}) is at or above the upper Bollinger Band ($${upper.toFixed(2)}). The stock may be overbought and could pull back.`;
    } else if (price < middle) {
      signal = 'BUY';
      explanation = `Price is below the middle band ($${middle.toFixed(2)}), suggesting it's in the lower half of its recent range.`;
    } else {
      signal = 'HOLD';
      explanation = `Price is between the middle and upper Bollinger Band. In a normal trading range.`;
    }

    signals.push({
      name: 'Bollinger Bands',
      value: `Lower: ${lower.toFixed(2)} | Mid: ${middle.toFixed(2)} | Upper: ${upper.toFixed(2)}`,
      signal,
      explanation,
      educationalInfo:
        'Bollinger Bands consist of a middle band (20-day SMA) and upper/lower bands set at 2 standard deviations. They measure volatility — when bands are narrow, volatility is low (potential breakout coming). When price touches the lower band, the stock may be oversold. Touching the upper band may indicate overbought conditions. About 95% of price action occurs within the bands.',
    });
  }

  // 5. Stochastic Oscillator
  if (indicators.stochastic) {
    const { k, d } = indicators.stochastic;
    let signal: Signal;
    let explanation: string;

    if (k < 20 && d < 20) {
      signal = k > d ? 'STRONG_BUY' : 'BUY';
      explanation = `Stochastic is in oversold territory (K: ${k.toFixed(1)}, D: ${d.toFixed(1)}).${k > d ? ' K crossing above D suggests a reversal.' : ''}`;
    } else if (k > 80 && d > 80) {
      signal = k < d ? 'STRONG_SELL' : 'SELL';
      explanation = `Stochastic is in overbought territory (K: ${k.toFixed(1)}, D: ${d.toFixed(1)}).${k < d ? ' K crossing below D suggests a reversal.' : ''}`;
    } else if (k > d) {
      signal = 'BUY';
      explanation = `Stochastic K (${k.toFixed(1)}) is above D (${d.toFixed(1)}), indicating upward momentum.`;
    } else {
      signal = 'HOLD';
      explanation = `Stochastic is in the neutral zone. No extreme conditions detected.`;
    }

    signals.push({
      name: 'Stochastic Oscillator',
      value: `K: ${k.toFixed(1)} | D: ${d.toFixed(1)}`,
      signal,
      explanation,
      educationalInfo:
        'The Stochastic Oscillator compares a stock\'s closing price to its price range over 14 periods. It generates K (fast) and D (slow) lines on a 0-100 scale. Below 20 is oversold, above 80 is overbought. When K crosses above D in oversold territory, it\'s a buy signal. When K crosses below D in overbought territory, it\'s a sell signal.',
    });
  }

  // 6. ADX (Average Directional Index)
  if (indicators.adx !== null) {
    let signal: Signal;
    let explanation: string;

    if (indicators.adx > 40) {
      signal = 'HOLD'; // Strong trend — don't fight it
      explanation = `ADX is ${indicators.adx.toFixed(1)}, indicating a very strong trend. Follow the current trend direction.`;
    } else if (indicators.adx > 25) {
      signal = 'HOLD';
      explanation = `ADX is ${indicators.adx.toFixed(1)}, indicating a developing trend. The current direction has strength.`;
    } else {
      signal = 'HOLD';
      explanation = `ADX is ${indicators.adx.toFixed(1)}, indicating a weak or absent trend. The market may be ranging.`;
    }

    signals.push({
      name: 'ADX (Average Directional Index)',
      value: indicators.adx.toFixed(1),
      signal,
      explanation,
      educationalInfo:
        'ADX measures trend strength on a 0-100 scale, regardless of direction. Below 20 means weak/no trend (ranging market). 20-25 is an emerging trend. 25-40 is a strong trend. Above 40 is extremely strong. ADX doesn\'t tell you the direction — just how strong the trend is. Use it with other indicators to confirm entry/exit points.',
    });
  }

  // 7. OBV Trend
  {
    let signal: Signal;
    let explanation: string;

    if (indicators.obvTrend === 'rising') {
      signal = 'BUY';
      explanation = 'On-Balance Volume is rising, indicating buying pressure is increasing. Smart money may be accumulating.';
    } else if (indicators.obvTrend === 'falling') {
      signal = 'SELL';
      explanation = 'On-Balance Volume is falling, indicating selling pressure is increasing. Distribution may be occurring.';
    } else {
      signal = 'HOLD';
      explanation = 'On-Balance Volume is flat, indicating no clear buying or selling pressure.';
    }

    signals.push({
      name: 'OBV (On-Balance Volume)',
      value: indicators.obvTrend.charAt(0).toUpperCase() + indicators.obvTrend.slice(1),
      signal,
      explanation,
      educationalInfo:
        'On-Balance Volume (OBV) tracks cumulative buying and selling pressure by adding volume on up days and subtracting it on down days. A rising OBV suggests that volume is heavier on up days (accumulation/buying). A falling OBV suggests distribution (selling). OBV often moves before the price, making it a leading indicator.',
    });
  }

  // Calculate overall score
  const totalScore = signals.reduce((sum, s) => sum + getSignalScore(s.signal), 0);
  const avgScore = signals.length > 0 ? totalScore / signals.length : 0;
  const overallSignal = scoreToSignal(avgScore);

  // Confidence based on agreement
  const buySignals = signals.filter((s) => s.signal === 'BUY' || s.signal === 'STRONG_BUY').length;
  const sellSignals = signals.filter((s) => s.signal === 'SELL' || s.signal === 'STRONG_SELL').length;
  const totalDirectional = buySignals + sellSignals;
  const agreement = totalDirectional > 0
    ? Math.max(buySignals, sellSignals) / signals.length
    : 0;
  const confidence = Math.round(agreement * 100);

  // Risk level based on ATR and volatility
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (indicators.atr !== null && quote.price > 0) {
    const atrPercent = (indicators.atr / quote.price) * 100;
    if (atrPercent > 4) riskLevel = 'HIGH';
    else if (atrPercent < 1.5) riskLevel = 'LOW';
  }

  // Generate summary
  const summary = generateSummary(quote, overallSignal, signals, confidence, riskLevel);

  return {
    stock: quote,
    overallSignal,
    confidence,
    indicators: signals,
    summary,
    riskLevel,
  };
}

function generateSummary(
  quote: StockQuote,
  signal: Signal,
  indicators: IndicatorSignal[],
  confidence: number,
  riskLevel: string
): string {
  const buyCount = indicators.filter((i) => i.signal === 'BUY' || i.signal === 'STRONG_BUY').length;
  const sellCount = indicators.filter((i) => i.signal === 'SELL' || i.signal === 'STRONG_SELL').length;

  let action = '';
  switch (signal) {
    case 'STRONG_BUY':
      action = `${quote.symbol} shows strong bullish signals. ${buyCount} out of ${indicators.length} indicators suggest buying.`;
      break;
    case 'BUY':
      action = `${quote.symbol} has moderate bullish signals. ${buyCount} out of ${indicators.length} indicators lean towards buying.`;
      break;
    case 'HOLD':
      action = `${quote.symbol} shows mixed signals. It's best to hold your current position and wait for a clearer trend.`;
      break;
    case 'SELL':
      action = `${quote.symbol} has bearish signals. ${sellCount} out of ${indicators.length} indicators suggest selling.`;
      break;
    case 'STRONG_SELL':
      action = `${quote.symbol} shows strong bearish signals. ${sellCount} out of ${indicators.length} indicators recommend selling.`;
      break;
  }

  return `${action} Confidence: ${confidence}%. Risk Level: ${riskLevel}. Current price: ${quote.currency === 'IDR' ? 'Rp' : '$'}${quote.price.toLocaleString()}.`;
}

export function getWatchAction(
  buyPrice: number,
  currentPrice: number,
  indicators: TechnicalIndicators,
  stopLossPrice?: number | null,
  takeProfitPrice?: number | null
): { action: Signal; reason: string } {
  const pnlPercent = ((currentPrice - buyPrice) / buyPrice) * 100;

  const planHint = (() => {
    const sl =
      typeof stopLossPrice === 'number' && Number.isFinite(stopLossPrice) && stopLossPrice > 0
        ? stopLossPrice
        : null;
    const tp =
      typeof takeProfitPrice === 'number' && Number.isFinite(takeProfitPrice) && takeProfitPrice > 0
        ? takeProfitPrice
        : null;

    if (!sl && !tp) return '';

    // Compute risk-reward factor (R multiple) if both SL and TP exist and SL is below entry.
    let rrPart = '';
    if (sl !== null && tp !== null && sl < buyPrice && tp !== buyPrice) {
      const riskPerUnit = buyPrice - sl;
      const rewardPerUnit = tp - buyPrice;
      if (riskPerUnit > 0) {
        const rr = rewardPerUnit / riskPerUnit;
        if (Number.isFinite(rr)) rrPart = ` (factor ≈ ${rr.toFixed(2)}R)`;
      }
    }

    const parts: string[] = [];
    if (sl !== null) parts.push(`SL ${sl.toLocaleString()}`);
    if (tp !== null) parts.push(`TP ${tp.toLocaleString()}`);
    return parts.length > 0 ? ` Plan: ${parts.join(' • ')}${rrPart}.` : '';
  })();

  const missingPlanHint =
    !stopLossPrice && !takeProfitPrice
      ? ' Add SL/TP prices to make this risk-based.'
      : '';

  // Explicit SL/TP plan (if provided)
  if (stopLossPrice != null && stopLossPrice > 0 && currentPrice <= stopLossPrice) {
    return {
      action: 'STRONG_SELL',
      reason: `Current price has reached your stop-loss (${currentPrice.toLocaleString()} ≤ ${stopLossPrice.toLocaleString()}). Consider exiting to follow your plan.${planHint}`,
    };
  }

  if (takeProfitPrice != null && takeProfitPrice > 0 && currentPrice >= takeProfitPrice) {
    return {
      action: 'SELL',
      reason: `Current price has reached your take-profit (${currentPrice.toLocaleString()} ≥ ${takeProfitPrice.toLocaleString()}). Consider taking profits per your plan.${planHint}`,
    };
  }

  // Large profit with overbought signals
  if (pnlPercent >= 20 && indicators.rsi !== null && indicators.rsi > 70) {
    return {
      action: 'SELL',
      reason: `You're up ${pnlPercent.toFixed(1)}% and the RSI (${indicators.rsi.toFixed(1)}) indicates overbought conditions. Consider taking profits.${planHint}`,
    };
  }

  // Trailing stop for large gains
  if (pnlPercent >= 15) {
    if (indicators.macd && indicators.macd.histogram < 0) {
      return {
        action: 'SELL',
        reason: `You're up ${pnlPercent.toFixed(1)}% but MACD momentum is fading (histogram is negative). Consider locking in profits with a trailing stop.${planHint}`,
      };
    }
    return {
      action: 'HOLD',
      reason: `You're up ${pnlPercent.toFixed(1)}%. Momentum is still positive. Set a trailing stop to protect gains.${planHint}`,
    };
  }

  // Moderate loss with bearish indicators
  if (pnlPercent <= -3 && indicators.rsi !== null && indicators.rsi < 35) {
    return {
      action: 'HOLD',
      reason: `You're down ${Math.abs(pnlPercent).toFixed(1)}% but RSI (${indicators.rsi.toFixed(1)}) shows oversold conditions. A bounce may occur. Consider holding, but keep risk defined via your stop-loss.${planHint}${missingPlanHint}`,
    };
  }

  if (pnlPercent <= -3 && indicators.macd && indicators.macd.histogram < 0) {
    return {
      action: 'SELL',
      reason: `You're down ${Math.abs(pnlPercent).toFixed(1)}% and bearish momentum continues (MACD histogram negative). Consider reducing position.${planHint}${missingPlanHint}`,
    };
  }

  // Default HOLD
  if (pnlPercent > 0) {
    return {
      action: 'HOLD',
      reason: `You're up ${pnlPercent.toFixed(1)}%. No strong exit signals yet. Continue monitoring.${planHint}`,
    };
  } else {
    return {
      action: 'HOLD',
      reason: `You're down ${Math.abs(pnlPercent).toFixed(1)}%. Within normal range. Keep your risk defined and monitor closely.${planHint}${missingPlanHint}`,
    };
  }
}