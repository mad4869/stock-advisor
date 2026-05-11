/**
 * Stock Data Service — Yahoo Finance Provider
 *
 * Provides stock quotes and historical data using the Yahoo Finance v8 API.
 * For fundamentals, analysis, and search, use yahooFinance2.ts instead.
 */

import { StockQuote, HistoricalData, Market } from '@/types';
import { quoteCache, historyCache, CACHE_TTL } from './cache';
import { IDX_FULL_LIST, POPULAR_STOCKS, lookupStockName } from './constants';

// ============================================================
// PUBLIC API
// ============================================================

export async function getStockQuote(symbol: string, market: Market): Promise<StockQuote> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `quote:${clean}:${market}`;

  const cached = quoteCache.get<StockQuote>(cacheKey);
  if (cached) {
    return cached;
  }

  const quote = await getYahooQuote(clean, market);
  quoteCache.set(cacheKey, quote, CACHE_TTL.QUOTE);
  return quote;
}

export async function getHistoricalData(
  symbol: string,
  market: Market,
  months: number = 12
): Promise<HistoricalData[]> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `history:${clean}:${market}:${months}`;

  const cached = historyCache.get<HistoricalData[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await getYahooHistorical(clean, market, months);
  historyCache.set(cacheKey, data, CACHE_TTL.HISTORICAL);
  return data;
}

// ============================================================
// HELPERS
// ============================================================

function cleanSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace('.JK', '')
    .replace('.JKT', '')
    .replace(/\s+/g, '')
    .trim();
}

function yahooSymbol(symbol: string, market: Market): string {
  const clean = cleanSymbol(symbol);
  return market === 'ID' ? `${clean}.JK` : clean;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// YAHOO FINANCE PROVIDER
// ============================================================

const YAHOO_BASE = 'https://query1.finance.yahoo.com';

async function yahooFetch(url: string): Promise<any> {
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

async function getYahooQuote(symbol: string, market: Market): Promise<StockQuote> {
  const ySymbol = yahooSymbol(symbol, market);

  const url = `${YAHOO_BASE}/v8/finance/chart/${ySymbol}?range=5d&interval=1d&includePrePost=false`;
  const data = await yahooFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data for ${ySymbol}. The symbol may not exist or the market is closed.`);
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: cleanSymbol(symbol),
    name: meta.longName || meta.shortName || lookupStockName(cleanSymbol(symbol)),
    market,
    price: market === 'ID' ? Math.round(price) : Math.round(price * 100) / 100,
    currency: market === 'ID' ? 'IDR' : meta.currency || 'USD',
    change: market === 'ID' ? Math.round(change) : Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: meta.regularMarketVolume || 0,
    high52Week: meta.fiftyTwoWeekHigh,
    low52Week: meta.fiftyTwoWeekLow,
  };
}

async function getYahooHistorical(
  symbol: string,
  market: Market,
  months: number
): Promise<HistoricalData[]> {
  const ySymbol = yahooSymbol(symbol, market);
  const period1 = Math.floor(Date.now() / 1000 - months * 30.44 * 24 * 60 * 60);
  const period2 = Math.floor(Date.now() / 1000);

  const url = `${YAHOO_BASE}/v8/finance/chart/${ySymbol}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
  const data = await yahooFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error(`No historical data for ${ySymbol}`);
  }

  const timestamps: number[] = result.timestamp;
  const quotes = result.indicators?.quote?.[0];
  if (!quotes) {
    throw new Error(`No OHLCV data for ${ySymbol}`);
  }

  const historicalData: HistoricalData[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quotes.open?.[i];
    const high = quotes.high?.[i];
    const low = quotes.low?.[i];
    const close = quotes.close?.[i];
    const volume = quotes.volume?.[i];

    // Skip days with null data (holidays, halted trading)
    if (open == null || high == null || low == null || close == null) continue;

    const roundFn = (v: number) =>
      market === 'ID' ? Math.round(v) : Math.round(v * 100) / 100;

    historicalData.push({
      date: new Date(timestamps[i] * 1000),
      open: roundFn(open),
      high: roundFn(high),
      low: roundFn(low),
      close: roundFn(close),
      volume: volume || 0,
    });
  }

  if (historicalData.length === 0) {
    throw new Error(`Empty historical data for ${ySymbol}`);
  }

  return historicalData;
}

// Re-export constants for backward compatibility
export { POPULAR_STOCKS, IDX_FULL_LIST } from './constants';