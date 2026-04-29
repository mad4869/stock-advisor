/**
 * Yahoo Finance 2 wrapper for fundamental/financial statement data.
 * Uses the `yahoo-finance2` library which handles crumb/cookie auth automatically.
 * This is separate from the existing yahooFetch (v8/v1) used for quotes/history.
 */

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { fundamentalsCache, CACHE_TTL } from './cache';
import {
  ComprehensiveAnalysis,
  CompanyProfile,
  AnnualFinancials,
  AnnualBalanceSheet,
  AnnualCashFlow,
  DividendInfo,
  PeerData,
} from '@/types/analysis';
import { FundamentalData } from '@/types/screener';
import { Market } from '@/types';


// Build the Yahoo symbol (add .JK suffix for Indonesian stocks)
function toYSymbol(symbol: string, market: Market): string {
  if (market === 'ID') {
    return symbol.endsWith('.JK') ? symbol : `${symbol}.JK`;
  }
  return symbol;
}

// ============================================================
// searchStocks2 — for stock search
// ============================================================

export async function searchStocks2(
  query: string,
  market?: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  const q = query.trim();
  if (!q) return [];

  // Re-use searchCache from cache.ts if we want, or just fetch directly.
  // We'll just fetch directly for simplicity, but let's use the same filtering.
  try {
    const res = await yahooFinance.search(q);
    const quotes = res.quotes;
    
    if (!quotes || !Array.isArray(quotes)) return [];

    return quotes
      .filter((q: any) => {
        // Only equities or ETFs
        if (q.quoteType !== 'EQUITY' && q.quoteType !== 'ETF') return false;

        const isIDX = q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
        const isUS = !q.symbol?.includes('.') ||
          ['NYQ', 'NMS', 'NGM', 'NYSE', 'NASDAQ', 'BATS', 'PCX'].includes(q.exchange);

        // Only include US and IDX stocks since that's what the app supports
        return isIDX || isUS;
      })
      .slice(0, 10)
      .map((q: any) => {
        const isIDX = q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
        return {
          symbol: q.symbol?.replace('.JK', '') || q.symbol,
          name: q.longname || q.shortname || q.symbol,
          market: isIDX ? ('ID' as Market) : ('US' as Market),
        };
      })
      .sort((a, b) => {
        // Bubble the currently selected market to the top
        if (market) {
          if (a.market === market && b.market !== market) return -1;
          if (a.market !== market && b.market === market) return 1;
        }
        return 0;
      });
  } catch (err) {
    console.error('[YF2] Search error:', err);
    return [];
  }
}


// ============================================================
// getStockFundamentals2 — for screener (replaces manual v10 call)
// ============================================================

export async function getStockFundamentals2(
  symbol: string,
  market: Market
): Promise<FundamentalData> {
  const cacheKey = `fundamentals2:${symbol}:${market}`;
  const cached = fundamentalsCache.get<FundamentalData>(cacheKey);
  if (cached) return cached;

  const ySymbol = toYSymbol(symbol, market);

  let summary: any;
  try {
    summary = await yahooFinance.quoteSummary(ySymbol, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'],
    });
  } catch (err: any) {
    // For some tickers (often IDX names, delisted symbols, etc.) Yahoo returns no fundamentals.
    // Screener UI expects "no match" rather than a hard error.
    const empty: FundamentalData = {
      symbol,
      name: symbol,
      market,
      currency: market === 'ID' ? 'IDR' : 'USD',
      peRatio: null,
      forwardPE: null,
      pbRatio: null,
      psRatio: null,
      pegRatio: null,
      evToEbitda: null,
      roe: null,
      roa: null,
      netProfitMargin: null,
      grossMargin: null,
      operatingMargin: null,
      revenueGrowth: null,
      earningsGrowth: null,
      epsGrowthCurrentYear: null,
      epsGrowthNext5Y: null,
      debtToEquity: null,
      currentRatio: null,
      freeCashFlow: null,
      dividendYield: null,
      payoutRatio: null,
      marketCap: null,
      avgVolume3M: null,
      high52Week: null,
      low52Week: null,
      beta: null,
      price: null,
      sharesOutstanding: null,
    };

    fundamentalsCache.set(cacheKey, empty, CACHE_TTL.FUNDAMENTALS);
    return empty;
  }

  const sd = summary.summaryDetail || {};
  const ks = summary.defaultKeyStatistics || {};
  const fd = summary.financialData || {};

  const r = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    return null;
  };

  const pct = (v: any): number | null => {
    const n = r(v);
    return n != null ? n * 100 : null;
  };

  const result: FundamentalData = {
    symbol,
    name: symbol,
    market,
    currency: market === 'ID' ? 'IDR' : 'USD',
    peRatio: r(sd.trailingPE),
    forwardPE: r(sd.forwardPE),
    pbRatio: r(sd.priceToBook),
    psRatio: r(sd.priceToSalesTrailing12Months),
    pegRatio: r(ks.pegRatio),
    evToEbitda: r(ks.enterpriseToEbitda),
    roe: pct(fd.returnOnEquity),
    roa: pct(fd.returnOnAssets),
    netProfitMargin: pct(fd.profitMargins),
    grossMargin: pct(fd.grossMargins),
    operatingMargin: pct(fd.operatingMargins),
    revenueGrowth: pct(fd.revenueGrowth),
    earningsGrowth: pct(fd.earningsGrowth),
    epsGrowthCurrentYear: null,
    epsGrowthNext5Y: null,
    debtToEquity: fd.debtToEquity != null ? (fd.debtToEquity as number) / 100 : null,
    currentRatio: r(fd.currentRatio),
    freeCashFlow: r(fd.freeCashflow),
    dividendYield: pct(sd.dividendYield),
    payoutRatio: pct(sd.payoutRatio),
    marketCap: r(sd.marketCap),
    avgVolume3M: r(sd.averageVolume),
    high52Week: r(sd.fiftyTwoWeekHigh),
    low52Week: r(sd.fiftyTwoWeekLow),
    beta: r(sd.beta) ?? r(ks.beta),
    price: r(fd.currentPrice),
    sharesOutstanding: r(ks.sharesOutstanding) ?? r(sd.impliedSharesOutstanding) ?? null,
  };

  fundamentalsCache.set(cacheKey, result, CACHE_TTL.FUNDAMENTALS);
  return result;
}

// ============================================================
// getComprehensiveAnalysis2 — full analysis dashboard data
// ============================================================

export async function getComprehensiveAnalysis2(
  symbol: string,
  market: Market
): Promise<ComprehensiveAnalysis> {
  const cacheKey = `analysis2:${symbol}:${market}`;
  const cached = fundamentalsCache.get<ComprehensiveAnalysis>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Analysis2: ${symbol}`);
    return cached;
  }

  const ySymbol = toYSymbol(symbol, market);
  console.log(`[YF2] Comprehensive Analysis: ${ySymbol}`);

  // Single quoteSummary call with all needed modules
  const result: any = await yahooFinance.quoteSummary(ySymbol, {
    modules: [
      'assetProfile',
      'defaultKeyStatistics',
      'financialData',
      'summaryDetail',
      'earningsTrend',
      'incomeStatementHistory',
      'balanceSheetHistory',
      'cashflowStatementHistory',
      'calendarEvents',
      'recommendationTrend',
    ],
  });

  const ap = result.assetProfile || {};
  const ks = result.defaultKeyStatistics || {};
  const fd = result.financialData || {};
  const sd = result.summaryDetail || {};
  const earningsTrend: any[] = (result.earningsTrend as any)?.trend || [];

  // Helper: safely get number
  const r = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    return null;
  };
  const pct = (v: any): number | null => {
    const n = r(v);
    return n != null ? n * 100 : null;
  };
  const fmtDate = (v: any): string => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'string') return v.slice(0, 10);
    return '';
  };

  // ---- Profile ----
  const profile: CompanyProfile = {
    name: (ap as any).longName || (ap as any).shortName || symbol,
    symbol,
    market,
    sector: (ap as any).sector || 'Unknown',
    industry: (ap as any).industry || 'Unknown',
    description: (ap as any).longBusinessSummary || '',
    website: (ap as any).website || '',
    officers: ((ap as any).companyOfficers || []).slice(0, 5).map((o: any) => ({
      name: o.name || '',
      title: o.title || '',
      age: o.age,
    })),
    address: [(ap as any).address1, (ap as any).city, (ap as any).state, (ap as any).country]
      .filter(Boolean).join(', '),
    country: (ap as any).country || '',
    employeeCount: r((ap as any).fullTimeEmployees),
  };

  // ---- EPS trend ----
  let epsGrowthCurrentYear: number | null = null;
  let epsGrowthNext5Y: number | null = null;
  for (const trend of earningsTrend) {
    const g = r(trend.growth);
    if (trend.period === '0y' && g != null) epsGrowthCurrentYear = g * 100;
    if (trend.period === '+5y' && g != null) epsGrowthNext5Y = g * 100;
  }

  // ---- FundamentalData ----
  const fundamentalData: FundamentalData = {
    symbol,
    name: profile.name,
    market,
    currency: market === 'ID' ? 'IDR' : 'USD',
    peRatio: r(sd.trailingPE),
    forwardPE: r(sd.forwardPE),
    pbRatio: r(sd.priceToBook),
    psRatio: r(sd.priceToSalesTrailing12Months),
    pegRatio: r(ks.pegRatio),
    evToEbitda: r(ks.enterpriseToEbitda),
    roe: pct(fd.returnOnEquity),
    roa: pct(fd.returnOnAssets),
    netProfitMargin: pct(fd.profitMargins),
    grossMargin: pct(fd.grossMargins),
    operatingMargin: pct(fd.operatingMargins),
    revenueGrowth: pct(fd.revenueGrowth),
    earningsGrowth: pct(fd.earningsGrowth),
    epsGrowthCurrentYear,
    epsGrowthNext5Y,
    debtToEquity: fd.debtToEquity != null ? (fd.debtToEquity as number) / 100 : null,
    currentRatio: r(fd.currentRatio),
    freeCashFlow: r(fd.freeCashflow),
    dividendYield: pct(sd.dividendYield),
    payoutRatio: pct(sd.payoutRatio),
    marketCap: r(sd.marketCap),
    avgVolume3M: r(sd.averageVolume),
    high52Week: r(sd.fiftyTwoWeekHigh),
    low52Week: r(sd.fiftyTwoWeekLow),
    beta: r(sd.beta) ?? r(ks.beta),
    price: r(fd.currentPrice),
    sharesOutstanding: r(ks.sharesOutstanding) ?? r(sd.impliedSharesOutstanding) ?? null,
  };

  // ---- Income Statements ----
  const incomeStatements: AnnualFinancials[] = (
    (result.incomeStatementHistory as any)?.incomeStatementHistory || []
  ).map((stmt: any) => {
    const rev = r(stmt.totalRevenue);
    const gp = r(stmt.grossProfit);
    const oi = r(stmt.operatingIncome);
    const ni = r(stmt.netIncome);
    const year = fmtDate(stmt.endDate).slice(0, 4);
    return {
      year,
      endDate: fmtDate(stmt.endDate),
      totalRevenue: rev,
      grossProfit: gp,
      operatingIncome: oi,
      netIncome: ni,
      ebit: r(stmt.ebit) ?? oi,
      eps: r(stmt.dilutedEps) ?? r(stmt.basicEps),
      interestExpense: r(stmt.interestExpense),
      grossMargin: rev && gp ? (gp / rev) * 100 : null,
      operatingMargin: rev && oi ? (oi / rev) * 100 : null,
      netMargin: rev && ni ? (ni / rev) * 100 : null,
      incomeBeforeTax: r(stmt.incomeBeforeTax),
      incomeTaxExpense: r(stmt.incomeTaxExpense),
    };
  }).sort((a: AnnualFinancials, b: AnnualFinancials) => a.year.localeCompare(b.year));

  // ---- Balance Sheets ----
  const balanceSheets: AnnualBalanceSheet[] = (
    (result.balanceSheetHistory as any)?.balanceSheetStatements || []
  ).map((stmt: any) => {
    const ta = r(stmt.totalAssets);
    const te = r(stmt.totalStockholderEquity) ?? r(stmt.stockholdersEquity);
    const tl = r(stmt.totalLiab) ?? r(stmt.totalLiabilities);
    const td = r(stmt.totalDebt) ?? r(stmt.longTermDebt);
    const ca = r(stmt.totalCurrentAssets);
    const cl = r(stmt.totalCurrentLiabilities);
    const cash = r(stmt.cash) ?? r(stmt.cashAndCashEquivalents);
    const std = r(stmt.shortLongTermDebt) ?? r(stmt.currentDebt) ?? r(stmt.shortTermDebt);
    const ltd = r(stmt.longTermDebt);
    const inv = r(stmt.inventory);
    const year = fmtDate(stmt.endDate).slice(0, 4);
    return {
      year,
      endDate: fmtDate(stmt.endDate),
      totalAssets: ta,
      totalLiabilities: tl,
      totalEquity: te,
      totalDebt: td,
      shortTermDebt: std,
      longTermDebt: ltd,
      currentAssets: ca,
      currentLiabilities: cl,
      cash,
      goodwill: r(stmt.goodWill),
      debtToEquity: td != null && te != null && te > 0 ? td / te : null,
      currentRatio: ca != null && cl != null && cl > 0 ? ca / cl : null,
      quickRatio: ca != null && cl != null && inv != null && cl > 0 ? (ca - inv) / cl : null,
    };
  }).sort((a: AnnualBalanceSheet, b: AnnualBalanceSheet) => a.year.localeCompare(b.year));

  // ---- Cash Flows ----
  const cashFlowStatements: AnnualCashFlow[] = (
    (result.cashflowStatementHistory as any)?.cashflowStatements || []
  ).map((stmt: any) => {
    const ocf = r(stmt.totalCashFromOperatingActivities);
    const rawCapex = r(stmt.capitalExpenditures);
    const capexAbs = rawCapex != null ? Math.abs(rawCapex) : null;
    const year = fmtDate(stmt.endDate).slice(0, 4);
    return {
      year,
      endDate: fmtDate(stmt.endDate),
      operatingCashFlow: ocf,
      capitalExpenditure: capexAbs,
      freeCashFlow: ocf != null && capexAbs != null ? ocf - capexAbs : null,
      dividendsPaid: r(stmt.dividendsPaid) != null ? Math.abs(r(stmt.dividendsPaid)!) : null,
    };
  }).sort((a: AnnualCashFlow, b: AnnualCashFlow) => a.year.localeCompare(b.year));

  // ---- Dividend Info ----
  const calEvents = result.calendarEvents as any;
  const dividendInfo: DividendInfo = {
    dividendYield: fundamentalData.dividendYield,
    dividendRate: r(sd.dividendRate),
    payoutRatio: fundamentalData.payoutRatio,
    exDividendDate: sd.exDividendDate ? fmtDate(sd.exDividendDate) : null,
    dividendDate: calEvents?.dividendDate ? fmtDate(calEvents.dividendDate) : null,
    fiveYearAvgDividendYield: r(sd.fiveYearAvgDividendYield),
  };

  // ---- Analyst Rating ----
  const recTrends = (result.recommendationTrend as any)?.trend || [];
  const latestRec = recTrends[0] || {};
  const analystRating = {
    buy: (r(latestRec.strongBuy) || 0) + (r(latestRec.buy) || 0),
    hold: r(latestRec.hold) || 0,
    sell: (r(latestRec.sell) || 0) + (r(latestRec.strongSell) || 0),
    targetMeanPrice: r(fd.targetMeanPrice),
    targetHighPrice: r(fd.targetHighPrice),
    targetLowPrice: r(fd.targetLowPrice),
  };

  // ---- CAGR ----
  const computeCAGR = (values: (number | null)[], years: number): number | null => {
    const startIdx = Math.max(0, values.length - years - 1);
    const endIdx = values.length - 1;
    const start = values[startIdx];
    const end = values[endIdx];
    const n = endIdx - startIdx;
    if (start == null || end == null || start <= 0 || n <= 0) return null;
    return (Math.pow(end / start, 1 / n) - 1) * 100;
  };

  const revenues = incomeStatements.map((s) => s.totalRevenue);
  const epsValues = incomeStatements.map((s) => s.eps);

  // ---- Derived metrics ----
  const latestCF = cashFlowStatements[cashFlowStatements.length - 1];
  const latestIncome = incomeStatements[incomeStatements.length - 1];
  const latestBS = balanceSheets[balanceSheets.length - 1];

  const fcfMargin =
    latestCF?.freeCashFlow != null && latestIncome?.totalRevenue
      ? (latestCF.freeCashFlow / latestIncome.totalRevenue) * 100
      : null;
  const fcfYield =
    latestCF?.freeCashFlow != null && fundamentalData.marketCap
      ? (latestCF.freeCashFlow / fundamentalData.marketCap) * 100
      : null;
  const interestCoverage =
    latestIncome?.ebit != null && latestIncome?.interestExpense
      ? Math.abs(latestIncome.ebit / latestIncome.interestExpense)
      : null;
  const debtToEbitda =
    latestBS?.totalDebt != null && latestIncome?.operatingIncome
      ? latestBS.totalDebt / latestIncome.operatingIncome
      : null;

  const analysis: ComprehensiveAnalysis = {
    profile,
    fundamentals: fundamentalData,
    enterpriseValue: r(ks.enterpriseValue),
    financials: incomeStatements,
    balanceSheets,
    cashFlows: cashFlowStatements,
    dividend: dividendInfo,
    analystRating,
    cagr: {
      revenue3Y: computeCAGR(revenues, 3),
      revenue5Y: computeCAGR(revenues, 5),
      eps3Y: computeCAGR(epsValues, 3),
      eps5Y: computeCAGR(epsValues, 5),
    },
    fcfMargin,
    fcfYield,
    interestCoverage,
    debtToEbitda,
  };

  fundamentalsCache.set(cacheKey, analysis, CACHE_TTL.FUNDAMENTALS);
  return analysis;
}

// ============================================================
// getPeerAnalysis2 — peer comparison using yf2
// ============================================================

export async function getPeerAnalysis2(
  sector: string,
  market: Market,
  excludeSymbol: string,
  sectorMap: Record<string, string>,
  popularStocks: Array<{ symbol: string; name: string; market: string; sector?: string }>,
  maxPeers: number = 5
): Promise<PeerData[]> {
  let peerSymbols: string[] = [];

  if (market === 'ID') {
    peerSymbols = Object.entries(sectorMap)
      .filter(([sym, sec]) => sec === sector && sym !== excludeSymbol)
      .map(([sym]) => sym)
      .slice(0, maxPeers);
  } else {
    peerSymbols = popularStocks
      .filter((s) => s.market === 'US' && s.sector === sector && s.symbol !== excludeSymbol)
      .map((s) => s.symbol)
      .slice(0, maxPeers);
  }

  const peers: PeerData[] = [];
  for (const sym of peerSymbols) {
    try {
      const fund = await getStockFundamentals2(sym, market);
      peers.push({
        symbol: fund.symbol,
        name: fund.name,
        peRatio: fund.peRatio,
        pbRatio: fund.pbRatio,
        roe: fund.roe,
        netProfitMargin: fund.netProfitMargin,
        revenueGrowth: fund.revenueGrowth,
        debtToEquity: fund.debtToEquity,
        dividendYield: fund.dividendYield,
        marketCap: fund.marketCap,
      });
    } catch (e: any) {
      console.warn(`[Peer2] ${sym}: ${e.message}`);
    }
  }
  return peers;
}
