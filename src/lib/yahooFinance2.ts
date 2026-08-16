/**
 * Yahoo Finance 2 wrapper for fundamental/financial statement data.
 * Uses the `yahoo-finance2` library which handles crumb/cookie auth automatically.
 * This is separate from the existing yahooFetch (v8/v1) used for quotes/history.
 */

import YahooFinance from 'yahoo-finance2';

/** Shared yahoo-finance2 instance — import this instead of creating new instances */
export const yf = new YahooFinance();
const yahooFinance = yf;
import { fundamentalsCache, CACHE_TTL } from './cache';
import {
  ComprehensiveAnalysis,
  CompanyProfile,
  AnnualFinancials,
  AnnualBalanceSheet,
  AnnualCashFlow,
  DividendInfo,
  DividendPayment,
  PeerData,
  ShortInterestData,
  EpsRevisionData,
  EarningsCalendar,
  UpgradeDowngradeHistory,
  AnalystAction,
} from '@/types/analysis';
import { FundamentalData } from '@/types/screener';
import { Market } from '@/types';


// Build the Yahoo symbol (add .JK suffix for Indonesian stocks)
export function toYSymbol(symbol: string, market: Market): string {
  const clean = symbol
    .toUpperCase()
    .replace('.JK', '')
    .replace('.JKT', '')
    .replace(/\s+/g, '')
    .trim();
  return market === 'ID' ? `${clean}.JK` : clean;
}

async function retryYahooFinanceCall<T>(fn: () => Promise<T>, maxRetries = 3, delay = 500): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw err;
      }
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.warn(`[YF2] Error in Yahoo Finance call. Retrying in ${backoffDelay}ms... (Attempt ${attempt}/${maxRetries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error('Retries failed');
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

  let rawQuotes: any[] = [];

  try {
    const res = await retryYahooFinanceCall(() => yahooFinance.search(q));
    rawQuotes = res.quotes || [];
  } catch (err: any) {
    // yahoo-finance2 throws FailedYahooValidationError when Yahoo changes their schema.
    // The raw data is still present in err.result.quotes — use it if available.
    if (err?.result?.quotes && Array.isArray(err.result.quotes)) {
      console.warn('[YF2] Search schema validation error (using raw results):', err.message);
      rawQuotes = err.result.quotes;
    } else {
      console.error('[YF2] Search error:', err);
      return [];
    }
  }

  if (!rawQuotes || !Array.isArray(rawQuotes)) return [];

  const mapped = rawQuotes
    .filter((q: any) => {
      // Only equities or ETFs
      if (q.quoteType !== 'EQUITY' && q.quoteType !== 'ETF') return false;

      const isIDX = q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
      const isUS =
        !q.symbol?.includes('.') ||
        ['NYQ', 'NMS', 'NGM', 'NYSE', 'NASDAQ', 'BATS', 'PCX'].includes(q.exchange);

      // Only include US and IDX stocks since that's what the app supports
      return isIDX || isUS;
    })
    .map((q: any) => {
      const isIDX = q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
      return {
        symbol: q.symbol?.replace('.JK', '') || q.symbol,
        name: q.longname || q.shortname || q.symbol,
        market: isIDX ? ('ID' as Market) : ('US' as Market),
      };
    });

  // De-dupe by (market, symbol) to avoid collisions like US:BULL vs ID:BULL
  const seen = new Set<string>();
  const unique = mapped.filter((r) => {
    const key = `${r.market}:${r.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // If a market is selected, prioritize it *before* slicing.
  unique.sort((a, b) => {
    if (market) {
      if (a.market === market && b.market !== market) return -1;
      if (a.market !== market && b.market === market) return 1;
    }
    return 0;
  });

  return unique.slice(0, 10);
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
    summary = await retryYahooFinanceCall(() =>
      yahooFinance.quoteSummary(ySymbol, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
      })
    );
  } catch (err: any) {
    // For some tickers (often IDX names, delisted symbols, etc.) Yahoo returns no fundamentals.
    // Screener UI expects "no match" rather than a hard error.
    const empty: FundamentalData = {
      symbol,
      name: symbol,
      market,
      currency: market === 'ID' ? 'IDR' : 'USD',
      sector: null,
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
      npl: null,
      car: null,
    };

    fundamentalsCache.set(cacheKey, empty, CACHE_TTL.FUNDAMENTALS);
    return empty;
  }

  const sd = summary.summaryDetail || {};
  const ks = summary.defaultKeyStatistics || {};
  const fd = summary.financialData || {};
  const ap = summary.assetProfile || {};

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
    sector: ap.sector || null,
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
    npl: null,
    car: null,
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

  // Concurrent quoteSummary and dividend event chart fetch
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const [result, chartDivs]: [any, any] = await Promise.all([
    retryYahooFinanceCall(() =>
      yahooFinance.quoteSummary(ySymbol, {
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
          'upgradeDowngradeHistory',   // NEW: analyst upgrade/downgrade activity
          'insiderTransactions',       // NEW: insider trade transactions
          'netSharePurchaseActivity',  // NEW: insider trade net summary
        ],
      })
    ),
    retryYahooFinanceCall(() =>
      yahooFinance.chart(ySymbol, {
        period1: fiveYearsAgo.toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        events: 'div',
      })
    ).catch((err: any) => {
      console.warn(`[YF2] Failed to fetch dividend history for ${ySymbol}: ${err.message}`);
      return null;
    }),
  ]);

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
    sector: profile.sector || null,
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
    npl: null,
    car: null,
  };

  // ---- Income Statements ----
  const rawCFStatements = (result.cashflowStatementHistory as any)?.cashflowStatements || [];
  const getDepreciationForDate = (endDate: string): number => {
    const cfStmt = rawCFStatements.find((s: any) => fmtDate(s.endDate) === endDate);
    if (!cfStmt) return 0;
    return r(cfStmt.depreciation) ?? r(cfStmt.depreciationAndAmortization) ?? r(cfStmt.depreciationAmortizationDepletion) ?? 0;
  };

  const incomeStatements: AnnualFinancials[] = (
    (result.incomeStatementHistory as any)?.incomeStatementHistory || []
  ).map((stmt: any) => {
    const rev = r(stmt.totalRevenue);
    const gp = r(stmt.grossProfit);
    const oi = r(stmt.operatingIncome);
    const ni = r(stmt.netIncome);
    const dep = getDepreciationForDate(fmtDate(stmt.endDate));
    const year = fmtDate(stmt.endDate).slice(0, 4);
    return {
      year,
      endDate: fmtDate(stmt.endDate),
      totalRevenue: rev,
      grossProfit: gp,
      operatingIncome: oi,
      netIncome: ni,
      ebit: r(stmt.ebit) ?? oi,
      ebitda: oi != null ? oi + dep : null,
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
    const dep = r(stmt.depreciation) ?? r(stmt.depreciationAndAmortization) ?? r(stmt.depreciationAmortizationDepletion) ?? null;
    const year = fmtDate(stmt.endDate).slice(0, 4);
    return {
      year,
      endDate: fmtDate(stmt.endDate),
      operatingCashFlow: ocf,
      capitalExpenditure: capexAbs,
      freeCashFlow: ocf != null && capexAbs != null ? ocf - capexAbs : null,
      dividendsPaid: r(stmt.dividendsPaid) != null ? Math.abs(r(stmt.dividendsPaid)!) : null,
      depreciation: dep,
    };
  }).sort((a: AnnualCashFlow, b: AnnualCashFlow) => a.year.localeCompare(b.year));

  // ---- Dividend Info & History ----
  const calEvents = result.calendarEvents as any;

  // Process historical dividend payment events from chart
  const rawDividendEvents: any[] = chartDivs?.events?.dividends || [];
  const dividendPayments: DividendPayment[] = rawDividendEvents
    .filter((e: any) => e && e.amount != null && e.amount > 0 && e.date)
    .map((e: any) => ({
      date: fmtDate(e.date),
      amount: Number(e.amount),
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // Newest first

  // Derive dividend frequency: annualRate / lastSinglePayment ≈ payments per year
  // lastDividendValue may be in summaryDetail OR defaultKeyStatistics depending on the market
  const annualDivRate = r(sd.dividendRate) ?? r(sd.trailingAnnualDividendRate);
  const lastDivValue = r(sd.lastDividendValue) ?? r(ks.lastDividendValue);
  let dividendFrequency: number | null = null;
  let dividendFrequencyLabel: string | null = null;
  if (annualDivRate != null && annualDivRate > 0 && lastDivValue != null && lastDivValue > 0) {
    const rawFreq = annualDivRate / lastDivValue;
    // Snap to known frequencies: 1, 2, 4, 12
    const knownFreqs = [1, 2, 4, 12];
    const closest = knownFreqs.reduce((prev, curr) =>
      Math.abs(curr - rawFreq) < Math.abs(prev - rawFreq) ? curr : prev
    );
    // Accept if within 40% of a known frequency (wider tolerance for IDX stocks)
    if (Math.abs(closest - rawFreq) / closest < 0.40) {
      dividendFrequency = closest;
      dividendFrequencyLabel =
        closest === 12 ? `Monthly (12×/yr)` :
        closest === 4  ? `Quarterly (4×/yr)` :
        closest === 2  ? `Semi-Annual (2×/yr)` :
                         `Annual (1×/yr)`;
    }
  }

  // Fallback: If frequency wasn't derived from ratios, estimate from past 12 months payments count
  if (!dividendFrequencyLabel && dividendPayments.length > 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
    const recentPayments = dividendPayments.filter(p => p.date >= oneYearAgoStr);
    const count = recentPayments.length;
    if (count > 0) {
      dividendFrequency = count;
      dividendFrequencyLabel =
        count >= 10 ? `Monthly (~12×/yr)` :
        count === 4 ? `Quarterly (4×/yr)` :
        count === 2 ? `Semi-Annual (2×/yr)` :
        count === 1 ? `Annual (1×/yr)` :
        `${count}×/yr`;
    }
  }

  const dividendInfo: DividendInfo = {
    dividendYield: fundamentalData.dividendYield,
    dividendRate: r(sd.dividendRate),
    payoutRatio: fundamentalData.payoutRatio,
    exDividendDate: sd.exDividendDate ? fmtDate(sd.exDividendDate) : null,
    dividendDate: calEvents?.dividendDate ? fmtDate(calEvents.dividendDate) : null,
    fiveYearAvgDividendYield: r(sd.fiveYearAvgDividendYield),
    dividendFrequency,
    dividendFrequencyLabel,
    payments: dividendPayments,
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
    if (values.length < years + 1) return null;
    const startIdx = values.length - years - 1;
    const endIdx = values.length - 1;
    const start = values[startIdx];
    const end = values[endIdx];
    const n = endIdx - startIdx;
    if (start == null || end == null || start <= 0 || end <= 0 || n <= 0) return null;
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
    latestBS?.totalDebt != null && latestIncome?.ebitda != null && latestIncome.ebitda !== 0
      ? latestBS.totalDebt / latestIncome.ebitda
      : null;

  // ---- Short Interest (from defaultKeyStatistics) ----
  const shortPercentOfFloat = r(ks.shortPercentOfFloat);
  const sharesShort = r(ks.sharesShort);
  const sharesShortPriorMonth = r(ks.sharesShortPriorMonth);
  const shortInterest: ShortInterestData = {
    shortPercentOfFloat: shortPercentOfFloat != null ? shortPercentOfFloat * 100 : null, // convert to 0-100 scale
    shortRatio: r(ks.shortRatio),
    sharesShort,
    sharesShortPriorMonth,
    shortInterestRising:
      sharesShort != null && sharesShortPriorMonth != null && sharesShortPriorMonth > 0
        ? sharesShort > sharesShortPriorMonth
        : null,
  };

  // ---- EPS Revision (from earningsTrend) ----
  let epsRevision: EpsRevisionData = {
    epsRevisionUp: null,
    currentEstimate: null,
    thirtyDayAgoEstimate: null,
    revisionPercent: null,
  };
  {
    const nearTerm = earningsTrend.find(
      (t: any) => t.period === '0q' || t.period === '0y'
    );
    if (nearTerm?.epsTrend) {
      const current = r(nearTerm.epsTrend.current);
      const thirtyDaysAgo = r(nearTerm.epsTrend['30daysAgo']);
      epsRevision = {
        currentEstimate: current,
        thirtyDayAgoEstimate: thirtyDaysAgo,
        epsRevisionUp:
          current != null && thirtyDaysAgo != null && thirtyDaysAgo !== 0
            ? current > thirtyDaysAgo
            : null,
        revisionPercent:
          current != null && thirtyDaysAgo != null && thirtyDaysAgo !== 0
            ? ((current - thirtyDaysAgo) / Math.abs(thirtyDaysAgo)) * 100
            : null,
      };
    }
  }

  // ---- Earnings Calendar (from calendarEvents) ----
  let earningsCalendar: EarningsCalendar = {
    nextEarningsDate: null,
    daysToEarnings: null,
    isEarningsImminent: false,
  };
  {
    const calEarnings = (calEvents as any)?.earnings;
    const earningsDatesRaw: any[] = calEarnings?.earningsDate || [];
    const now = Date.now();
    const upcomingTs = earningsDatesRaw
      .map((d: any) => {
        if (d instanceof Date) return d.getTime();
        if (typeof d === 'string') return new Date(d).getTime();
        return null;
      })
      .filter((t): t is number => t != null && t > now)
      .sort((a, b) => a - b);

    if (upcomingTs.length > 0) {
      const nextTs = upcomingTs[0];
      const daysAway = Math.ceil((nextTs - now) / (1000 * 60 * 60 * 24));
      earningsCalendar = {
        nextEarningsDate: new Date(nextTs).toISOString().split('T')[0],
        daysToEarnings: daysAway,
        isEarningsImminent: daysAway <= 7,
      };
    }
  }

  // ---- Upgrade/Downgrade History ----
  let upgradeDowngrades: UpgradeDowngradeHistory = {
    recentActions: [],
    upgradeCount30d: 0,
    downgradeCount30d: 0,
    netScore: 0,
  };
  {
    const rawHistory: any[] = (result.upgradeDowngradeHistory as any)?.history || [];
    const cutoff90d = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const recentActions: AnalystAction[] = rawHistory
      .filter((item: any) => {
        const ts = item.epochGradeDate ? item.epochGradeDate * 1000 : null;
        return ts && ts >= cutoff90d;
      })
      .map((item: any): AnalystAction => {
        const action = item.action?.toLowerCase() || '';
        let normalizedAction: AnalystAction['action'] = 'reit';
        if (action === 'up') normalizedAction = 'upgrade';
        else if (action === 'down') normalizedAction = 'downgrade';
        else if (action === 'init' || action === 'main') normalizedAction = 'init';
        return {
          firm: item.firm || 'Unknown',
          toGrade: item.toGrade || '',
          fromGrade: item.fromGrade || '',
          action: normalizedAction,
          date: item.epochGradeDate
            ? new Date(item.epochGradeDate * 1000).toISOString().split('T')[0]
            : '',
        };
      })
      .slice(0, 20); // cap at 20 for response size

    // Count 30-day upgrades vs downgrades
    let upgradeCount30d = 0;
    let downgradeCount30d = 0;
    for (const item of rawHistory) {
      const ts = item.epochGradeDate ? item.epochGradeDate * 1000 : null;
      if (!ts || ts < cutoff30d) continue;
      const action = item.action?.toLowerCase() || '';
      if (action === 'up') upgradeCount30d++;
      else if (action === 'down') downgradeCount30d++;
    }

    upgradeDowngrades = {
      recentActions,
      upgradeCount30d,
      downgradeCount30d,
      netScore: upgradeCount30d - downgradeCount30d,
    };
  }

  // ---- 52-Week Relative Strength ----
  const stock52WChange = r(ks['52WeekChange']) != null ? r(ks['52WeekChange'])! * 100 : null;
  const sp52WChange = r(ks.SandP52WeekChange) != null ? r(ks.SandP52WeekChange)! * 100 : null;
  const relativeStrength52W =
    stock52WChange != null && sp52WChange != null
      ? stock52WChange - sp52WChange
      : null;

  // ---- 52-Week Low & Fibonacci Levels ----
  const fiftyTwoWeekLow = r(sd.fiftyTwoWeekLow) != null ? r(sd.fiftyTwoWeekLow) : r(ks.fiftyTwoWeekLow);
  const fiftyTwoWeekHigh = r(sd.fiftyTwoWeekHigh) != null ? r(sd.fiftyTwoWeekHigh) : r(ks.fiftyTwoWeekHigh);
  let fibonacciLevels: any = null;
  if (fiftyTwoWeekHigh != null && fiftyTwoWeekLow != null && fiftyTwoWeekHigh > fiftyTwoWeekLow) {
    const diff = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    fibonacciLevels = {
      high: fiftyTwoWeekHigh,
      low: fiftyTwoWeekLow,
      fib236: fiftyTwoWeekHigh - diff * 0.236,
      fib382: fiftyTwoWeekHigh - diff * 0.382,
      fib500: fiftyTwoWeekHigh - diff * 0.500,
      fib618: fiftyTwoWeekHigh - diff * 0.618,
      fib786: fiftyTwoWeekHigh - diff * 0.786,
    };
  }

  // ---- Insider Activity ----
  let insiderActivity: any = null;
  if (result.insiderTransactions || result.netSharePurchaseActivity) {
    const rawTransactions: any[] = (result.insiderTransactions as any)?.transactions || [];
    const netPurchase: any = result.netSharePurchaseActivity || {};

    const recentTransactions = rawTransactions.slice(0, 10).map((t: any) => ({
      filerName: t.filerName || 'Unknown',
      filerRelation: t.filerRelation || 'Unknown',
      shares: r(t.shares) || 0,
      date: t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '',
      transactionText: t.transactionText || 'Unknown',
    }));

    insiderActivity = {
      netSharesBought90d: r(netPurchase.netSharePurchaseActivity) || null,
      buyShares90d: r(netPurchase.buyInfoShares) || null,
      sellShares90d: r(netPurchase.sellInfoShares) || null,
      recentTransactions,
    };
  }

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
    // New enrichment fields
    shortInterest,
    epsRevision,
    earningsCalendar,
    upgradeDowngrades,
    relativeStrength52W,
    stock52WChange,
    fiftyTwoWeekLow,
    fibonacciLevels,
    insiderActivity,
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
