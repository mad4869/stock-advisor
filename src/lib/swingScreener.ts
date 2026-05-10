import YahooFinance from 'yahoo-finance2';
import { calculateTA, TAData } from './technicalIndicators';
import { fetchSmartMoney, SmartMoneyMetrics } from './bandarmology';
import { historyCache, quoteSummaryCache, CACHE_TTL } from './cache';

const yf = new YahooFinance();

export interface ScreenerResult {
  symbol: string;
  market: 'US' | 'ID';
  taScore: number;
  taData: TAData | null;
  smartMoney: SmartMoneyMetrics | null;
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
  const isUS = market === 'US';
  const querySymbol = market === 'ID' && !symbol.endsWith('.JK') ? `${symbol}.JK` : symbol;
  const historyCacheKey = `history:${querySymbol}`;
  const quoteSummaryCacheKey = `quoteSummary:${querySymbol}`;

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
    // 1. Fetch History
    let history = historyCache.get<any[]>(historyCacheKey);
    if (!history) {
      // Fetch ~250 trading days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 365); // 1 year calendar = ~252 trading days
      
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

    // 2. Fetch Smart Money (cached individually within fetchSmartMoney or here)
    // Actually, let's let fetchSmartMoney handle its own caching if we want, but since it fetches multiple endpoints, we should cache it here.
    let smartMoney = quoteSummaryCache.get<SmartMoneyMetrics>(quoteSummaryCacheKey);
    if (!smartMoney) {
      smartMoney = await fetchSmartMoney(querySymbol, market);
      quoteSummaryCache.set(quoteSummaryCacheKey, smartMoney, CACHE_TTL.QUOTE_SUMMARY);
    }
    result.smartMoney = smartMoney;

    // 3. Calculate TA
    const ta = calculateTA(history);
    if (!ta) {
      result.error = 'Failed to calculate TA';
      return result;
    }
    result.taData = ta;

    // 4. Score TA and Evaluate Presets
    let trendScore = 0; // max 30
    let volScore = 0;   // max 30
    let momScore = 0;   // max 25
    let structScore = 0; // max 15
    const signals: string[] = [];

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

    // Evaluate Presets
    let taPass = totalTaScore >= 60;
    let smPass = smartMoney.isPass;

    if (preset === 'BREAKOUT') {
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 2.0 : false;
      const adxReq = ta.adx ? ta.adx > 25 : false;
      // New 20-day high approximation -> distanceTo52wHigh very small, or close > upper BB
      const bbReq = ta.bollingerB ? ta.bollingerB > 0.8 : false;
      taPass = taPass && volReq && adxReq && bbReq;
      if (taPass) signals.push('Swing Breakout Setup');
    } 
    else if (preset === 'OVERSOLD') {
      const rsiReq = ta.rsi ? ta.rsi >= 40 && ta.rsi <= 55 : false; // Recovering
      const pivotReq = ta.distanceToS1 ? ta.distanceToS1 <= 0.05 && ta.distanceToS1 >= -0.02 : false;
      taPass = taPass && rsiReq && pivotReq;
      if (taPass) signals.push('Oversold Bounce Setup');
    }
    else if (preset === 'SMART_MONEY') {
      const smReq = smartMoney.institutionsNetIncrease === true && smartMoney.insiderNetBuy === true;
      const macdReq = ta.macdIncreasing;
      taPass = taPass && macdReq;
      smPass = smPass && smReq;
      if (taPass && smPass) signals.push('Smart Money Flow Confirmation');
    }
    else if (preset === 'VOLUME_CLIMAX') {
      const volReq = ta.volumeRatio ? ta.volumeRatio >= 3.0 : false;
      const emaReq = ta.ema50 ? price > ta.ema50 : false;
      const rsiReq = ta.rsi ? ta.rsi < 70 : false;
      taPass = taPass && volReq && emaReq && rsiReq;
      if (taPass) signals.push('Volume Climax Setup');
    }
    else if (preset === 'SHORT_SQUEEZE' && isUS) {
      const floatReq = smartMoney.shortFloatLow === false; // Highly shorted
      const cpReq = smartMoney.callPutRatioBullish === true;
      const emaReq = ta.ema20 ? price > ta.ema20 : false;
      taPass = taPass && emaReq;
      smPass = smPass && floatReq && cpReq;
      if (taPass && smPass) signals.push('Short Squeeze Setup');
    }

    result.signals = signals;
    result.isPass = taPass && smPass;

    return result;
  } catch (err: any) {
    result.error = err.message;
    return result;
  }
}
