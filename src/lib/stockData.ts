import { StockQuote, HistoricalData, Market, PopularStock } from '@/types';
import { FundamentalData } from '@/types/screener';
import { quoteCache, historyCache, searchCache, fundamentalsCache, CACHE_TTL } from './cache';
import { yahooLimiter, twelveDataLimiter } from './rateLimiter';

// ============================================================
// PROVIDER CONFIG
// ============================================================

type Provider = 'yahoo' | 'twelvedata' | 'mock';

function getUSProvider(): Provider {
  return (process.env.US_STOCK_PROVIDER || 'yahoo') as Provider;
}

function getIDXProvider(): Provider {
  return (process.env.IDX_STOCK_PROVIDER || 'yahoo') as Provider;
}

function getProvider(market: Market): Provider {
  return market === 'ID' ? getIDXProvider() : getUSProvider();
}

// ============================================================
// PUBLIC API
// ============================================================

export async function getStockQuote(symbol: string, market: Market): Promise<StockQuote> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `quote:${clean}:${market}`;

  // Check cache first
  const cached = quoteCache.get<StockQuote>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Quote: ${clean} (${market})`);
    return cached;
  }

  const provider = getProvider(market);
  let quote: StockQuote;

  try {
    switch (provider) {
      case 'yahoo':
        quote = await getYahooQuote(clean, market);
        break;
      case 'twelvedata':
        quote = await getTwelveDataQuote(clean, market);
        break;
      default:
        quote = await getMockQuote(clean, market);
    }
  } catch (error: any) {
    console.error(`[${provider}] Quote failed for ${clean}: ${error.message}`);

    // Fallback chain: yahoo → twelvedata → mock
    if (provider === 'yahoo') {
      try {
        console.log(`[Fallback] Trying twelvedata for ${clean}...`);
        quote = await getTwelveDataQuote(clean, market);
      } catch {
        console.log(`[Fallback] Using mock for ${clean}`);
        quote = await getMockQuote(clean, market);
      }
    } else if (provider === 'twelvedata') {
      try {
        console.log(`[Fallback] Trying yahoo for ${clean}...`);
        quote = await getYahooQuote(clean, market);
      } catch {
        console.log(`[Fallback] Using mock for ${clean}`);
        quote = await getMockQuote(clean, market);
      }
    } else {
      quote = await getMockQuote(clean, market);
    }
  }

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
    console.log(`[Cache HIT] History: ${clean} (${market}, ${months}mo)`);
    return cached;
  }

  const provider = getProvider(market);
  let data: HistoricalData[];

  try {
    switch (provider) {
      case 'yahoo':
        data = await getYahooHistorical(clean, market, months);
        break;
      case 'twelvedata':
        data = await getTwelveDataHistorical(clean, market, months);
        break;
      default:
        data = await getMockHistoricalData(clean, market, months);
    }
  } catch (error: any) {
    console.error(`[${provider}] Historical failed for ${clean}: ${error.message}`);

    // Fallback chain
    if (provider === 'yahoo') {
      try {
        data = await getTwelveDataHistorical(clean, market, months);
      } catch {
        data = await getMockHistoricalData(clean, market, months);
      }
    } else if (provider === 'twelvedata') {
      try {
        data = await getYahooHistorical(clean, market, months);
      } catch {
        data = await getMockHistoricalData(clean, market, months);
      }
    } else {
      data = await getMockHistoricalData(clean, market, months);
    }
  }

  historyCache.set(cacheKey, data, CACHE_TTL.HISTORICAL);
  return data;
}

export async function searchStocks(
  query: string,
  market?: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `search:${q}:${market || 'all'}`;
  const cached = searchCache.get<{ symbol: string; name: string; market: Market }[]>(cacheKey);
  if (cached) return cached;

  let results: { symbol: string; name: string; market: Market }[] = [];

  try {
    // Yahoo search works for ALL markets and is free
    results = await searchYahoo(q, market);
  } catch {
    // Fallback to local search
    results = searchLocal(q, market);
  }

  // If Yahoo returned nothing, supplement with local results
  if (results.length === 0) {
    results = searchLocal(q, market);
  }

  searchCache.set(cacheKey, results, CACHE_TTL.SEARCH);
  return results;
}

// ============================================================
// FUNDAMENTAL DATA (for Screener)
// Uses Yahoo quoteSummary v10 API with multiple modules
// ============================================================

export async function getStockFundamentals(
  symbol: string,
  market: Market
): Promise<FundamentalData> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `fundamentals:${clean}:${market}`;

  const cached = fundamentalsCache.get<FundamentalData>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Fundamentals: ${clean} (${market})`);
    return cached;
  }

  const ySymbol = yahooSymbol(clean, market);
  console.log(`[Yahoo] Fundamentals: ${ySymbol}`);

  const modules = [
    'defaultKeyStatistics',
    'financialData',
    'summaryDetail',
    'earningsTrend',
  ].join(',');

  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${ySymbol}?modules=${modules}`;

  try {
    const data = await yahooFetch(url);
    const result = data?.quoteSummary?.result?.[0];

    if (!result) {
      throw new Error(`No fundamentals data for ${ySymbol}`);
    }

    const keyStats = result.defaultKeyStatistics || {};
    const financials = result.financialData || {};
    const summary = result.summaryDetail || {};
    const earningsTrend = result.earningsTrend?.trend || [];

    // Helper to extract raw value from Yahoo's nested format
    const raw = (obj: any): number | null => {
      if (obj == null) return null;
      if (typeof obj === 'number') return obj;
      if (typeof obj === 'object' && 'raw' in obj) return obj.raw;
      return null;
    };

    // Extract EPS growth from earningsTrend
    let epsGrowthCurrentYear: number | null = null;
    let epsGrowthNext5Y: number | null = null;

    for (const trend of earningsTrend) {
      const period = trend.period;
      const growth = raw(trend.growth);
      if (period === '0y' && growth !== null) {
        epsGrowthCurrentYear = growth * 100; // convert to %
      }
      if (period === '+5y' && growth !== null) {
        epsGrowthNext5Y = growth * 100;
      }
    }

    const fundamentals: FundamentalData = {
      symbol: clean,
      name:
        IDX_FULL_LIST.find((s) => s.symbol === clean)?.name ||
        POPULAR_STOCKS.find((s) => s.symbol === clean)?.name ||
        clean,
      market,
      currency: market === 'ID' ? 'IDR' : 'USD',

      // Valuation
      peRatio: raw(summary.trailingPE) ?? raw(keyStats.trailingPE),
      forwardPE: raw(summary.forwardPE) ?? raw(keyStats.forwardPE),
      pbRatio: raw(summary.priceToBook) ?? raw(keyStats.priceToBook),
      psRatio: raw(summary.priceToSalesTrailing12Months),
      pegRatio: raw(keyStats.pegRatio),
      evToEbitda: raw(keyStats.enterpriseToEbitda),

      // Profitability
      roe: raw(financials.returnOnEquity) !== null ? (raw(financials.returnOnEquity)! * 100) : null,
      roa: raw(financials.returnOnAssets) !== null ? (raw(financials.returnOnAssets)! * 100) : null,
      netProfitMargin: raw(financials.profitMargins) !== null ? (raw(financials.profitMargins)! * 100) : null,
      grossMargin: raw(financials.grossMargins) !== null ? (raw(financials.grossMargins)! * 100) : null,
      operatingMargin: raw(financials.operatingMargins) !== null ? (raw(financials.operatingMargins)! * 100) : null,

      // Growth
      revenueGrowth: raw(financials.revenueGrowth) !== null ? (raw(financials.revenueGrowth)! * 100) : null,
      earningsGrowth: raw(financials.earningsGrowth) !== null ? (raw(financials.earningsGrowth)! * 100) : null,
      epsGrowthCurrentYear,
      epsGrowthNext5Y,

      // Financial Health
      debtToEquity: raw(financials.debtToEquity) !== null ? (raw(financials.debtToEquity)! / 100) : null,
      currentRatio: raw(financials.currentRatio),
      freeCashFlow: raw(financials.freeCashflow),

      // Income & Size
      dividendYield: raw(summary.dividendYield) !== null ? (raw(summary.dividendYield)! * 100) : null,
      payoutRatio: raw(summary.payoutRatio) !== null ? (raw(summary.payoutRatio)! * 100) : null,
      marketCap: raw(summary.marketCap),

      // Trading
      avgVolume3M: raw(summary.averageVolume),
      high52Week: raw(summary.fiftyTwoWeekHigh),
      low52Week: raw(summary.fiftyTwoWeekLow),
      beta: raw(summary.beta) ?? raw(keyStats.beta),

      // Price
      price: raw(financials.currentPrice),
    };

    fundamentalsCache.set(cacheKey, fundamentals, CACHE_TTL.FUNDAMENTALS);
    return fundamentals;
  } catch (error: any) {
    console.error(`[Yahoo] Fundamentals failed for ${ySymbol}: ${error.message}`);
    throw error;
  }
}

// ============================================================
// COMPREHENSIVE ANALYSIS (for Module 2: Fundamental Dashboard)
// Fetches all financial data in a single Yahoo quoteSummary call
// ============================================================

import {
  ComprehensiveAnalysis,
  CompanyProfile,
  AnnualFinancials,
  AnnualBalanceSheet,
  AnnualCashFlow,
  DividendInfo,
  PeerData,
} from '@/types/analysis';

export async function getComprehensiveAnalysis(
  symbol: string,
  market: Market
): Promise<ComprehensiveAnalysis> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `analysis:${clean}:${market}`;

  const cached = fundamentalsCache.get<ComprehensiveAnalysis>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Analysis: ${clean} (${market})`);
    return cached;
  }

  const ySymbol = yahooSymbol(clean, market);
  console.log(`[Yahoo] Comprehensive Analysis: ${ySymbol}`);

  const modules = [
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
  ].join(',');

  const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${ySymbol}?modules=${modules}`;
  const data = await yahooFetch(url);
  const result = data?.quoteSummary?.result?.[0];

  if (!result) {
    throw new Error(`No analysis data for ${ySymbol}`);
  }

  // Helper
  const raw = (obj: any): number | null => {
    if (obj == null) return null;
    if (typeof obj === 'number') return obj;
    if (typeof obj === 'object' && 'raw' in obj) return obj.raw;
    return null;
  };

  const fmtDate = (obj: any): string => {
    if (!obj) return '';
    const r = raw(obj);
    if (r && typeof r === 'number') return new Date(r * 1000).toISOString().split('T')[0];
    if (typeof obj === 'string') return obj;
    if (obj.fmt) return obj.fmt;
    return '';
  };

  // ---- Parse Asset Profile ----
  const ap = result.assetProfile || {};
  const profile: CompanyProfile = {
    name: ap.longName || ap.shortName || clean,
    symbol: clean,
    market,
    sector: ap.sector || 'Unknown',
    industry: ap.industry || 'Unknown',
    description: ap.longBusinessSummary || '',
    website: ap.website || '',
    officers: (ap.companyOfficers || []).slice(0, 5).map((o: any) => ({
      name: o.name || '',
      title: o.title || '',
      age: o.age || undefined,
    })),
    address: [ap.address1, ap.city, ap.state, ap.country].filter(Boolean).join(', '),
    country: ap.country || '',
    employeeCount: raw(ap.fullTimeEmployees),
  };

  // ---- Parse Key Stats + Financial Data + Summary Detail ----
  const keyStats = result.defaultKeyStatistics || {};
  const financials = result.financialData || {};
  const summary = result.summaryDetail || {};
  const earningsTrend = result.earningsTrend?.trend || [];

  // Build FundamentalData (reuse existing logic)
  let epsGrowthCurrentYear: number | null = null;
  let epsGrowthNext5Y: number | null = null;
  for (const trend of earningsTrend) {
    const growth = raw(trend.growth);
    if (trend.period === '0y' && growth !== null) epsGrowthCurrentYear = growth * 100;
    if (trend.period === '+5y' && growth !== null) epsGrowthNext5Y = growth * 100;
  }

  const fundamentalData: FundamentalData = {
    symbol: clean,
    name: profile.name,
    market,
    currency: market === 'ID' ? 'IDR' : 'USD',
    peRatio: raw(summary.trailingPE) ?? raw(keyStats.trailingPE),
    forwardPE: raw(summary.forwardPE) ?? raw(keyStats.forwardPE),
    pbRatio: raw(summary.priceToBook) ?? raw(keyStats.priceToBook),
    psRatio: raw(summary.priceToSalesTrailing12Months),
    pegRatio: raw(keyStats.pegRatio),
    evToEbitda: raw(keyStats.enterpriseToEbitda),
    roe: raw(financials.returnOnEquity) !== null ? raw(financials.returnOnEquity)! * 100 : null,
    roa: raw(financials.returnOnAssets) !== null ? raw(financials.returnOnAssets)! * 100 : null,
    netProfitMargin: raw(financials.profitMargins) !== null ? raw(financials.profitMargins)! * 100 : null,
    grossMargin: raw(financials.grossMargins) !== null ? raw(financials.grossMargins)! * 100 : null,
    operatingMargin: raw(financials.operatingMargins) !== null ? raw(financials.operatingMargins)! * 100 : null,
    revenueGrowth: raw(financials.revenueGrowth) !== null ? raw(financials.revenueGrowth)! * 100 : null,
    earningsGrowth: raw(financials.earningsGrowth) !== null ? raw(financials.earningsGrowth)! * 100 : null,
    epsGrowthCurrentYear,
    epsGrowthNext5Y,
    debtToEquity: raw(financials.debtToEquity) !== null ? raw(financials.debtToEquity)! / 100 : null,
    currentRatio: raw(financials.currentRatio),
    freeCashFlow: raw(financials.freeCashflow),
    dividendYield: raw(summary.dividendYield) !== null ? raw(summary.dividendYield)! * 100 : null,
    payoutRatio: raw(summary.payoutRatio) !== null ? raw(summary.payoutRatio)! * 100 : null,
    marketCap: raw(summary.marketCap),
    avgVolume3M: raw(summary.averageVolume),
    high52Week: raw(summary.fiftyTwoWeekHigh),
    low52Week: raw(summary.fiftyTwoWeekLow),
    beta: raw(summary.beta) ?? raw(keyStats.beta),
    price: raw(financials.currentPrice),
  };

  // ---- Parse Income Statements ----
  const incomeStatements: AnnualFinancials[] = (
    result.incomeStatementHistory?.incomeStatementHistory || []
  ).map((stmt: any) => {
    const rev = raw(stmt.totalRevenue);
    const gp = raw(stmt.grossProfit);
    const oi = raw(stmt.operatingIncome);
    const ni = raw(stmt.netIncome);
    return {
      year: fmtDate(stmt.endDate)?.slice(0, 4) || '',
      endDate: fmtDate(stmt.endDate),
      totalRevenue: rev,
      grossProfit: gp,
      operatingIncome: oi,
      netIncome: ni,
      ebit: raw(stmt.ebit) ?? oi,
      eps: raw(stmt.dilutedEPS),
      interestExpense: raw(stmt.interestExpense),
      grossMargin: rev && gp ? (gp / rev) * 100 : null,
      operatingMargin: rev && oi ? (oi / rev) * 100 : null,
      netMargin: rev && ni ? (ni / rev) * 100 : null,
    };
  }).sort((a: AnnualFinancials, b: AnnualFinancials) => a.year.localeCompare(b.year));

  // ---- Parse Balance Sheets ----
  const balanceSheets: AnnualBalanceSheet[] = (
    result.balanceSheetHistory?.balanceSheetStatements || []
  ).map((stmt: any) => {
    const ta = raw(stmt.totalAssets);
    const tl = raw(stmt.totalLiab);
    const te = raw(stmt.totalStockholderEquity);
    const td = raw(stmt.totalDebt) ?? raw(stmt.longTermDebt);
    const ca = raw(stmt.totalCurrentAssets);
    const cl = raw(stmt.totalCurrentLiabilities);
    const cash = raw(stmt.cash) ?? raw(stmt.cashAndCashEquivalents);
    const std = raw(stmt.shortTermDebt) ?? raw(stmt.currentDebt) ?? raw(stmt.shortLongTermDebt);
    const ltd = raw(stmt.longTermDebt);
    const inv = raw(stmt.inventory);

    return {
      year: fmtDate(stmt.endDate)?.slice(0, 4) || '',
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
      goodwill: raw(stmt.goodWill),
      debtToEquity: td != null && te != null && te > 0 ? td / te : null,
      currentRatio: ca != null && cl != null && cl > 0 ? ca / cl : null,
      quickRatio: ca != null && cl != null && inv != null && cl > 0 ? (ca - inv) / cl : null,
    };
  }).sort((a: AnnualBalanceSheet, b: AnnualBalanceSheet) => a.year.localeCompare(b.year));

  // ---- Parse Cash Flow Statements ----
  const cashFlowStatements: AnnualCashFlow[] = (
    result.cashflowStatementHistory?.cashflowStatements || []
  ).map((stmt: any) => {
    const ocf = raw(stmt.totalCashFromOperatingActivities);
    const capex = raw(stmt.capitalExpenditures); // usually negative
    const capexAbs = capex != null ? Math.abs(capex) : null;
    return {
      year: fmtDate(stmt.endDate)?.slice(0, 4) || '',
      endDate: fmtDate(stmt.endDate),
      operatingCashFlow: ocf,
      capitalExpenditure: capexAbs,
      freeCashFlow: ocf != null && capexAbs != null ? ocf - capexAbs : null,
      dividendsPaid: raw(stmt.dividendsPaid) != null ? Math.abs(raw(stmt.dividendsPaid)!) : null,
    };
  }).sort((a: AnnualCashFlow, b: AnnualCashFlow) => a.year.localeCompare(b.year));

  // ---- Dividend Info ----
  const calEvents = result.calendarEvents || {};
  const dividendInfo: DividendInfo = {
    dividendYield: fundamentalData.dividendYield,
    dividendRate: raw(summary.dividendRate),
    payoutRatio: fundamentalData.payoutRatio,
    exDividendDate: fmtDate(summary.exDividendDate) || null,
    dividendDate: fmtDate(calEvents.dividendDate) || null,
    fiveYearAvgDividendYield: raw(summary.fiveYearAvgDividendYield),
  };

  // ---- Analyst Recommendations ----
  const recTrends = result.recommendationTrend?.trend || [];
  const latestRec = recTrends[0] || {};
  const analystRating = {
    buy: (raw(latestRec.strongBuy) || 0) + (raw(latestRec.buy) || 0),
    hold: raw(latestRec.hold) || 0,
    sell: (raw(latestRec.sell) || 0) + (raw(latestRec.strongSell) || 0),
    targetMeanPrice: raw(financials.targetMeanPrice),
    targetHighPrice: raw(financials.targetHighPrice),
    targetLowPrice: raw(financials.targetLowPrice),
  };

  // ---- Compute CAGRs ----
  const computeCAGR = (values: (number | null)[], years: number): number | null => {
    if (values.length < 2) return null;
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

  // ---- Compute derived metrics ----
  const latestCF = cashFlowStatements[cashFlowStatements.length - 1];
  const latestIncome = incomeStatements[incomeStatements.length - 1];

  const fcfMargin = latestCF?.freeCashFlow != null && latestIncome?.totalRevenue != null && latestIncome.totalRevenue > 0
    ? (latestCF.freeCashFlow / latestIncome.totalRevenue) * 100
    : null;

  const fcfYield = latestCF?.freeCashFlow != null && fundamentalData.marketCap != null && fundamentalData.marketCap > 0
    ? (latestCF.freeCashFlow / fundamentalData.marketCap) * 100
    : null;

  const interestCoverage = latestIncome?.ebit != null && latestIncome?.interestExpense != null && latestIncome.interestExpense !== 0
    ? Math.abs(latestIncome.ebit / latestIncome.interestExpense)
    : null;

  const latestBS = balanceSheets[balanceSheets.length - 1];
  const latestDebt = latestBS?.totalDebt;
  // debtToEbitda: use the latest EBITDA proxy (operating income since we don't have D&A)
  const debtToEbitda = latestDebt != null && latestIncome?.operatingIncome != null && latestIncome.operatingIncome > 0
    ? latestDebt / latestIncome.operatingIncome
    : null;

  const analysis: ComprehensiveAnalysis = {
    profile,
    fundamentals: fundamentalData,
    enterpriseValue: raw(keyStats.enterpriseValue),
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
// PEER ANALYSIS
// Finds 4-6 stocks in same sector and fetches their fundamentals
// ============================================================

// Sector mapping for IDX stocks (for peer comparison)
const IDX_SECTOR_MAP: Record<string, string> = {
  // Banking
  BBCA: 'Financial', BBRI: 'Financial', BMRI: 'Financial', BBNI: 'Financial',
  BRIS: 'Financial', BTPS: 'Financial', MEGA: 'Financial', NISP: 'Financial',
  BNGA: 'Financial', BDMN: 'Financial', ARTO: 'Financial', BBYB: 'Financial',
  BNLI: 'Financial', BTPN: 'Financial', BJTM: 'Financial', BJBR: 'Financial',
  ADMF: 'Financial', BBLD: 'Financial', PNLF: 'Financial', LIFE: 'Financial',
  // Mining & Energy
  ADRO: 'Energy', ITMG: 'Energy', PTBA: 'Energy', ANTM: 'Energy',
  INCO: 'Energy', MDKA: 'Energy', MEDC: 'Energy', PGAS: 'Energy',
  ESSA: 'Energy', HRUM: 'Energy', TINS: 'Energy', BSSR: 'Energy',
  DSSA: 'Energy', MBAP: 'Energy', GEMS: 'Energy', UNTR: 'Energy',
  ADMR: 'Energy', PGEO: 'Energy', ELSA: 'Energy',
  // Telco & Tech
  TLKM: 'Technology', EXCL: 'Technology', ISAT: 'Technology',
  EMTK: 'Technology', TOWR: 'Technology', TBIG: 'Technology',
  GOTO: 'Technology', BUKA: 'Technology', DCII: 'Technology', MTDL: 'Technology',
  // Consumer
  ASII: 'Consumer Cyclical', UNVR: 'Consumer Defensive', HMSP: 'Consumer Defensive',
  ICBP: 'Consumer Defensive', INDF: 'Consumer Defensive', KLBF: 'Healthcare',
  GGRM: 'Consumer Defensive', MYOR: 'Consumer Defensive', CPIN: 'Consumer Defensive',
  SIDO: 'Consumer Defensive', ACES: 'Consumer Cyclical', AMRT: 'Consumer Defensive',
  MAPI: 'Consumer Cyclical', ERAA: 'Consumer Cyclical', LPPF: 'Consumer Cyclical',
  HERO: 'Consumer Defensive', RALS: 'Consumer Cyclical', JPFA: 'Consumer Defensive',
  MAIN: 'Consumer Defensive', CLEO: 'Consumer Defensive', AUTO: 'Consumer Cyclical',
  // Property & Construction
  BSDE: 'Real Estate', CTRA: 'Real Estate', SMRA: 'Real Estate',
  PWON: 'Real Estate', WIKA: 'Industrials', PTPP: 'Industrials',
  WSKT: 'Industrials', JSMR: 'Industrials', DILD: 'Real Estate',
  LPKR: 'Real Estate', APLN: 'Real Estate', SMGR: 'Industrials',
  // Industrial
  INKP: 'Industrials', TKIM: 'Industrials', BRPT: 'Industrials',
  TPIA: 'Industrials', IMPC: 'Industrials', SRIL: 'Industrials',
  // Healthcare
  HEAL: 'Healthcare', MIKA: 'Healthcare', SILO: 'Healthcare',
  PRDA: 'Healthcare', DVLA: 'Healthcare',
  // Plantation
  AALI: 'Consumer Defensive', LSIP: 'Consumer Defensive', DSNG: 'Consumer Defensive',
  TAPG: 'Consumer Defensive',
  // Media
  SCMA: 'Communication Services', MNCN: 'Communication Services',
  // Others
  AKRA: 'Energy', GIAA: 'Industrials',
};

export async function getPeerAnalysis(
  sector: string,
  market: Market,
  excludeSymbol: string,
  maxPeers: number = 5
): Promise<PeerData[]> {
  const clean = cleanSymbol(excludeSymbol);

  // Find peer symbols in the same sector
  let peerSymbols: string[] = [];

  if (market === 'ID') {
    // Use IDX_SECTOR_MAP
    peerSymbols = Object.entries(IDX_SECTOR_MAP)
      .filter(([sym, sec]) => sec === sector && sym !== clean)
      .map(([sym]) => sym);
  } else {
    // Use POPULAR_STOCKS for US
    peerSymbols = POPULAR_STOCKS
      .filter((s) => s.market === 'US' && s.sector === sector && s.symbol !== clean)
      .map((s) => s.symbol);
  }

  // Limit to maxPeers
  peerSymbols = peerSymbols.slice(0, maxPeers);

  if (peerSymbols.length === 0) return [];

  const peers: PeerData[] = [];

  for (const sym of peerSymbols) {
    try {
      const fund = await getStockFundamentals(sym, market);
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
    } catch (err: any) {
      console.warn(`[Peer] Failed to fetch ${sym}: ${err.message}`);
    }
  }

  return peers;
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
// YAHOO FINANCE PROVIDER (Free, No API Key, Full Coverage)
//
// Uses the v8 chart API which:
// - Works server-side without authentication
// - Covers ALL US stocks (NYSE, NASDAQ, AMEX)
// - Covers ALL Indonesian stocks (.JK suffix)
// - No hard rate limit (but we self-throttle to be polite)
// - Returns both quotes and historical data
// ============================================================

const YAHOO_BASE = 'https://query1.finance.yahoo.com';

async function yahooFetch(url: string): Promise<any> {
  return yahooLimiter.execute(async () => {
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
  });
}

async function getYahooQuote(symbol: string, market: Market): Promise<StockQuote> {
  const ySymbol = yahooSymbol(symbol, market);
  console.log(`[Yahoo] Quote: ${ySymbol}`);

  // Use chart API with range=1d for current quote
  const url = `${YAHOO_BASE}/v8/finance/chart/${ySymbol}?range=5d&interval=1d&includePrePost=false`;
  const data = await yahooFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo: No data for ${ySymbol}`);
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: cleanSymbol(symbol),
    name: meta.longName || meta.shortName || cleanSymbol(symbol),
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

  console.log(`[Yahoo] Historical: ${ySymbol} (${months}mo)`);

  const url = `${YAHOO_BASE}/v8/finance/chart/${ySymbol}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
  const data = await yahooFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error(`Yahoo: No historical data for ${ySymbol}`);
  }

  const timestamps: number[] = result.timestamp;
  const quotes = result.indicators?.quote?.[0];
  if (!quotes) {
    throw new Error(`Yahoo: No OHLCV data for ${ySymbol}`);
  }

  const historicalData: HistoricalData[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quotes.open?.[i];
    const high = quotes.high?.[i];
    const low = quotes.low?.[i];
    const close = quotes.close?.[i];
    const volume = quotes.volume?.[i];

    // Yahoo sometimes returns null for certain days
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
    throw new Error(`Yahoo: Empty historical data for ${ySymbol}`);
  }

  return historicalData;
}

async function searchYahoo(
  query: string,
  market?: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  console.log(`[Yahoo] Search: "${query}" market=${market || 'all'}`);

  const url = `${YAHOO_BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0&listsCount=0`;
  const data = await yahooFetch(url);

  const quotes = data?.quotes;
  if (!quotes || !Array.isArray(quotes)) return [];

  return quotes
    .filter((q: any) => {
      // Only equities
      if (q.quoteType !== 'EQUITY') return false;

      if (!market) return true;

      if (market === 'ID') {
        return q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
      }

      // US: exclude foreign stocks
      return (
        !q.symbol?.includes('.') ||
        q.exchange === 'NYQ' ||
        q.exchange === 'NMS' ||
        q.exchange === 'NGM' ||
        q.exchange === 'NYSE' ||
        q.exchange === 'NASDAQ'
      );
    })
    .slice(0, 10)
    .map((q: any) => {
      const isIDX = q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
      return {
        symbol: q.symbol?.replace('.JK', '') || q.symbol,
        name: q.longname || q.shortname || q.symbol,
        market: isIDX ? ('ID' as Market) : ('US' as Market),
      };
    });
}

// ============================================================
// TWELVE DATA PROVIDER (8 calls/min — rate limited)
// ============================================================

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

function getTwelveDataKey(): string {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error('TWELVE_DATA_API_KEY is not set');
  return key;
}

async function twelveDataFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  return twelveDataLimiter.execute(async () => {
    const apiKey = getTwelveDataKey();
    const searchParams = new URLSearchParams({ ...params, apikey: apiKey });
    const url = `${TWELVE_DATA_BASE}${endpoint}?${searchParams}`;

    console.log(
      `[TwelveData] ${endpoint} | symbol=${params.symbol} | queue=${twelveDataLimiter.pending}`
    );

    const res = await fetchWithTimeout(url);
    const data = await res.json();

    if (data.code && data.code !== 200) {
      throw new Error(data.message || `Twelve Data error: ${data.code}`);
    }
    if (data.status === 'error') {
      throw new Error(data.message || 'Twelve Data error');
    }

    return data;
  });
}

async function getTwelveDataQuote(symbol: string, market: Market): Promise<StockQuote> {
  const params: Record<string, string> = { symbol };
  if (market === 'ID') params.exchange = 'IDX';

  const data = await twelveDataFetch('/quote', params);

  const price = parseFloat(data.close) || 0;
  const prevClose = parseFloat(data.previous_close) || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: cleanSymbol(symbol),
    name: data.name || symbol,
    market,
    price: market === 'ID' ? Math.round(price) : Math.round(price * 100) / 100,
    currency: market === 'ID' ? 'IDR' : 'USD',
    change: market === 'ID' ? Math.round(change) : Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: parseInt(data.volume) || 0,
    high52Week: data.fifty_two_week?.high ? parseFloat(data.fifty_two_week.high) : undefined,
    low52Week: data.fifty_two_week?.low ? parseFloat(data.fifty_two_week.low) : undefined,
  };
}

async function getTwelveDataHistorical(
  symbol: string,
  market: Market,
  months: number
): Promise<HistoricalData[]> {
  const params: Record<string, string> = {
    symbol,
    interval: '1day',
    outputsize: Math.min(months * 22, 500).toString(),
    order: 'ASC',
  };
  if (market === 'ID') params.exchange = 'IDX';

  const data = await twelveDataFetch('/time_series', params);

  if (!data.values || !Array.isArray(data.values)) {
    throw new Error(`No historical data for ${symbol}`);
  }

  return data.values.map((item: any) => ({
    date: new Date(item.datetime),
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseInt(item.volume) || 0,
  }));
}

// ============================================================
// LOCAL SEARCH (for fallback when APIs fail)
// ============================================================

// ✅ FIXED — plain synchronous function, no Promise
function searchLocal(
  query: string,
  market?: Market
): { symbol: string; name: string; market: Market }[] {
  const q = query.toUpperCase();

  const allStocks = [
    ...IDX_FULL_LIST.map((s) => ({ ...s, market: 'ID' as Market })),
    ...POPULAR_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name, market: s.market })),
  ];

  return allStocks
    .filter((s) => {
      const matchesQuery = s.symbol.includes(q) || s.name.toUpperCase().includes(q);
      const matchesMarket = !market || s.market === market;
      return matchesQuery && matchesMarket;
    })
    .slice(0, 10);
}

// ============================================================
// COMPREHENSIVE IDX STOCK LIST
// ============================================================

const IDX_FULL_LIST: { symbol: string; name: string }[] = [
  // ===== LQ45 / Blue Chips =====
  { symbol: 'BBCA', name: 'Bank Central Asia' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia' },
  { symbol: 'BMRI', name: 'Bank Mandiri' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia' },
  { symbol: 'TLKM', name: 'Telkom Indonesia' },
  { symbol: 'ASII', name: 'Astra International' },
  { symbol: 'UNVR', name: 'Unilever Indonesia' },
  { symbol: 'HMSP', name: 'HM Sampoerna' },
  { symbol: 'ICBP', name: 'Indofood CBP Sukses Makmur' },
  { symbol: 'INDF', name: 'Indofood Sukses Makmur' },
  { symbol: 'KLBF', name: 'Kalbe Farma' },
  { symbol: 'GGRM', name: 'Gudang Garam' },
  { symbol: 'SMGR', name: 'Semen Indonesia' },

  // ===== Mining & Energy =====
  { symbol: 'ADRO', name: 'Adaro Energy Indonesia' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah' },
  { symbol: 'PTBA', name: 'Bukit Asam' },
  { symbol: 'ANTM', name: 'Aneka Tambang' },
  { symbol: 'INCO', name: 'Vale Indonesia' },
  { symbol: 'MDKA', name: 'Merdeka Copper Gold' },
  { symbol: 'MEDC', name: 'Medco Energi Internasional' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara' },
  { symbol: 'ESSA', name: 'Surya Esa Perkasa' },
  { symbol: 'HRUM', name: 'Harum Energy' },
  { symbol: 'TINS', name: 'Timah' },
  { symbol: 'BSSR', name: 'Baramulti Suksessarana' },
  { symbol: 'DSSA', name: 'Dian Swastatika Sentosa' },
  { symbol: 'MBAP', name: 'Mitrabara Adiperdana' },
  { symbol: 'GEMS', name: 'Golden Energy Mines' },
  { symbol: 'UNTR', name: 'United Tractors' },
  { symbol: 'ADMR', name: 'Adaro Minerals Indonesia' },
  { symbol: 'PGEO', name: 'Pertamina Geothermal Energy' },

  // ===== Banking =====
  { symbol: 'BRIS', name: 'Bank Syariah Indonesia' },
  { symbol: 'BTPS', name: 'Bank BTPN Syariah' },
  { symbol: 'MEGA', name: 'Bank Mega' },
  { symbol: 'NISP', name: 'Bank OCBC NISP' },
  { symbol: 'BNGA', name: 'Bank CIMB Niaga' },
  { symbol: 'BDMN', name: 'Bank Danamon Indonesia' },
  { symbol: 'ARTO', name: 'Bank Jago' },
  { symbol: 'BBYB', name: 'Bank Neo Commerce' },
  { symbol: 'BNLI', name: 'Bank Permata' },
  { symbol: 'BTPN', name: 'Bank BTPN' },
  { symbol: 'BJTM', name: 'Bank Jatim' },
  { symbol: 'BJBR', name: 'Bank BJB' },

  // ===== Telco & Technology =====
  { symbol: 'EXCL', name: 'XL Axiata' },
  { symbol: 'ISAT', name: 'Indosat Ooredoo Hutchison' },
  { symbol: 'EMTK', name: 'Elang Mahkota Teknologi' },
  { symbol: 'TOWR', name: 'Sarana Menara Nusantara' },
  { symbol: 'TBIG', name: 'Tower Bersama Infrastructure' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia' },
  { symbol: 'BUKA', name: 'Bukalapak.com' },
  { symbol: 'DCII', name: 'DCI Indonesia' },
  { symbol: 'MTDL', name: 'Metrodata Electronics' },

  // ===== Consumer & Retail =====
  { symbol: 'MYOR', name: 'Mayora Indah' },
  { symbol: 'CPIN', name: 'Charoen Pokphand Indonesia' },
  { symbol: 'SIDO', name: 'Industri Jamu Sido Muncul' },
  { symbol: 'ACES', name: 'Ace Hardware Indonesia' },
  { symbol: 'AMRT', name: 'Sumber Alfaria Trijaya' },
  { symbol: 'MAPI', name: 'Mitra Adiperkasa' },
  { symbol: 'ERAA', name: 'Erajaya Swasembada' },
  { symbol: 'LPPF', name: 'Matahari Department Store' },
  { symbol: 'HERO', name: 'Hero Supermarket' },
  { symbol: 'RALS', name: 'Ramayana Lestari Sentosa' },
  { symbol: 'JPFA', name: 'Japfa Comfeed Indonesia' },
  { symbol: 'MAIN', name: 'Malindo Feedmill' },
  { symbol: 'CLEO', name: 'Sariguna Primatirta' },

  // ===== Property & Construction =====
  { symbol: 'BSDE', name: 'Bumi Serpong Damai' },
  { symbol: 'CTRA', name: 'Ciputra Development' },
  { symbol: 'SMRA', name: 'Summarecon Agung' },
  { symbol: 'PWON', name: 'Pakuwon Jati' },
  { symbol: 'WIKA', name: 'Wijaya Karya' },
  { symbol: 'PTPP', name: 'PP (Persero)' },
  { symbol: 'WSKT', name: 'Waskita Karya' },
  { symbol: 'JSMR', name: 'Jasa Marga' },
  { symbol: 'DILD', name: 'Intiland Development' },
  { symbol: 'LPKR', name: 'Lippo Karawaci' },
  { symbol: 'APLN', name: 'Agung Podomoro Land' },

  // ===== Industrial & Manufacturing =====
  { symbol: 'INKP', name: 'Indah Kiat Pulp & Paper' },
  { symbol: 'TKIM', name: 'Pabrik Kertas Tjiwi Kimia' },
  { symbol: 'BRPT', name: 'Barito Pacific' },
  { symbol: 'TPIA', name: 'Chandra Asri Petrochemical' },
  { symbol: 'IMPC', name: 'Impack Pratama Industri' },
  { symbol: 'SRIL', name: 'Sri Rejeki Isman' },
  { symbol: 'AUTO', name: 'Astra Otoparts' },

  // ===== Healthcare & Pharma =====
  { symbol: 'HEAL', name: 'Medikaloka Hermina' },
  { symbol: 'MIKA', name: 'Mitra Keluarga Karyasehat' },
  { symbol: 'SILO', name: 'Siloam International Hospitals' },
  { symbol: 'PRDA', name: 'Prodia Widyahusada' },
  { symbol: 'DVLA', name: 'Darya-Varia Laboratoria' },

  // ===== Plantation & Agriculture =====
  { symbol: 'AALI', name: 'Astra Agro Lestari' },
  { symbol: 'LSIP', name: 'PP London Sumatra Indonesia' },
  { symbol: 'DSNG', name: 'Dharma Satya Nusantara' },

  // ===== Media & Entertainment =====
  { symbol: 'SCMA', name: 'Surya Citra Media' },
  { symbol: 'MNCN', name: 'MNC Studios International' },

  // ===== Finance (Non-Bank) =====
  { symbol: 'ADMF', name: 'Adira Dinamika Multi Finance' },
  { symbol: 'BBLD', name: 'Buana Finance' },
  { symbol: 'PNLF', name: 'Panin Financial' },
  { symbol: 'LIFE', name: 'Asuransi Jiwa Sinarmas MSIG' },

  // ===== Others =====
  { symbol: 'AKRA', name: 'AKR Corporindo' },
  { symbol: 'BNBR', name: 'Bakrie & Brothers' },
  { symbol: 'BUMI', name: 'Bumi Resources' },
  { symbol: 'DEWA', name: 'Darma Henwa' },
  { symbol: 'ELSA', name: 'Elnusa' },
  { symbol: 'GIAA', name: 'Garuda Indonesia' },
  { symbol: 'SSIA', name: 'Surya Semesta Internusa' },
  { symbol: 'TMAS', name: 'Pelayaran Tempuran Emas' },
  { symbol: 'TAPG', name: 'Triputra Agro Persada' },
];

// ============================================================
// MOCK PROVIDER
// ============================================================

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash & 2147483647) / 2147483647;
  };
}

const MOCK_PRICES: Record<string, number> = {
  AAPL: 185.5, MSFT: 415.2, GOOGL: 155.8, AMZN: 185.6, NVDA: 725.0,
  META: 505.75, TSLA: 238.45, JPM: 198.5, V: 280.3, JNJ: 158.2,
  BBCA: 9575, BBRI: 5725, BMRI: 6350, TLKM: 3850, ASII: 5225,
  UNVR: 2910, HMSP: 810, ICBP: 10400, KLBF: 1555, EMTK: 490,
  ITMG: 27350, ADRO: 2660, ANTM: 1545, INDF: 6475, GGRM: 24000,
  PGAS: 1500, MDKA: 2440, CPIN: 5050, EXCL: 2410, BRPT: 1045,
  BBNI: 5425, GOTO: 76, BUKA: 164, ARTO: 2650, TOWR: 1025,
  PTBA: 2980, UNTR: 26500, SMGR: 4020, MEDC: 1400, HRUM: 1605,
  INCO: 4250, MYOR: 2380, JPFA: 1445, AMRT: 2780, MAPI: 1625,
};

async function getMockQuote(symbol: string, market: Market): Promise<StockQuote> {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  const s = cleanSymbol(symbol);
  const basePrice = MOCK_PRICES[s] || (market === 'ID' ? 5000 : 150);
  const rand = seededRandom(s + new Date().toDateString());
  const changePercent = (rand() - 0.48) * 4;
  const change = basePrice * (changePercent / 100);
  const price = basePrice + change;

  const stockName =
    IDX_FULL_LIST.find((st) => st.symbol === s)?.name ||
    POPULAR_STOCKS.find((st) => st.symbol === s)?.name ||
    `${s} Corp.`;

  return {
    symbol: s,
    name: stockName,
    market,
    price: market === 'ID' ? Math.round(price) : Math.round(price * 100) / 100,
    currency: market === 'ID' ? 'IDR' : 'USD',
    change: market === 'ID' ? Math.round(change) : Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: Math.round(rand() * 50000000 + 1000000),
    marketCap: Math.round(basePrice * 1000000 * (rand() * 1000 + 100)),
    high52Week: Math.round(basePrice * 1.35),
    low52Week: Math.round(basePrice * 0.65),
  };
}

async function getMockHistoricalData(
  symbol: string,
  market: Market,
  months: number
): Promise<HistoricalData[]> {
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  const s = cleanSymbol(symbol);
  const basePrice = MOCK_PRICES[s] || (market === 'ID' ? 5000 : 150);
  const data: HistoricalData[] = [];
  const tradingDays = months * 21;
  const rand = seededRandom(s + 'hist');

  let currentPrice = basePrice * (0.8 + rand() * 0.4);

  for (let i = tradingDays; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - Math.round(i * 1.4));
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = (rand() - 0.48) * 0.03;
    currentPrice *= 1 + dailyReturn;
    currentPrice = Math.max(currentPrice, basePrice * 0.3);

    const dayRange = currentPrice * (0.005 + rand() * 0.025);
    const open = currentPrice + (rand() - 0.5) * dayRange;
    const high = Math.max(open, currentPrice) + rand() * dayRange;
    const low = Math.min(open, currentPrice) - rand() * dayRange;
    const vol = Math.round((500000 + rand() * 30000000) * (market === 'ID' ? 10 : 1));
    const roundFn = (v: number) =>
      market === 'ID' ? Math.round(v) : Math.round(v * 100) / 100;

    data.push({
      date,
      open: roundFn(open),
      high: roundFn(high),
      low: roundFn(Math.max(low, 1)),
      close: roundFn(currentPrice),
      volume: vol,
    });
  }

  return data;
}

// ============================================================
// POPULAR STOCKS
// ============================================================

export const POPULAR_STOCKS: PopularStock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', market: 'US', sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'US', sector: 'Healthcare' },
  { symbol: 'BBCA', name: 'Bank Central Asia', market: 'ID', sector: 'Financial' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', market: 'ID', sector: 'Financial' },
  { symbol: 'BMRI', name: 'Bank Mandiri', market: 'ID', sector: 'Financial' },
  { symbol: 'TLKM', name: 'Telkom Indonesia', market: 'ID', sector: 'Telecom' },
  { symbol: 'ASII', name: 'Astra International', market: 'ID', sector: 'Consumer Cyclical' },
  { symbol: 'UNVR', name: 'Unilever Indonesia', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'HMSP', name: 'HM Sampoerna', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'ICBP', name: 'Indofood CBP', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'KLBF', name: 'Kalbe Farma', market: 'ID', sector: 'Healthcare' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah', market: 'ID', sector: 'Energy' },
];

// Export stock universes for the screener
export const SCREENER_UNIVERSE = {
  US: POPULAR_STOCKS.filter((s) => s.market === 'US').map((s) => ({
    symbol: s.symbol,
    name: s.name,
  })),
  ID: IDX_FULL_LIST,
};