import { Market } from '@/types';
import { getHistoricalData } from '@/lib/stockData';
import { getComprehensiveAnalysis2 } from '@/lib/yahooFinance2';
import { calculateIndicators } from '@/lib/indicators';
import { calculateDCF, generateSensitivityMatrix, DCFInputs } from '@/lib/dcfCalculator';
import { DCFAssumptions, DCFResult } from '@/types/dcf';
import {
  calculateTechnicalScore,
  calculateFundamentalScore,
  calculateValuationScore,
  generateRecommendation,
  generateSummaryText,
} from '@/lib/scoringEngine';
import { CompositeScore } from '@/types/scoring';

export interface CompositeScoreOptions {
  historyMonths?: number;
}

export function buildBaseDCFAssumptions(params: {
  market: Market;
  beta: number | null | undefined;
  marketCap: number | null | undefined;
  recentDebt: number;
  recentInterestExpense: number;
  recentIncomeTaxExpense: number;
  recentIncomeBeforeTax: number;
  revenueCagr5Y: number | null | undefined;
  revenueCagr3Y: number | null | undefined;
}): DCFAssumptions {
  const isUS = params.market === 'US';

  const riskFreeRate = isUS ? 4.3 : 6.8;
  const equityRiskPremium = isUS ? 5.5 : 7.0;
  const beta = params.beta || 1.0;

  // Cost of Debt approximation: Interest Expense / Total Debt
  let costOfDebt = 5.0;
  if (params.recentInterestExpense > 0 && params.recentDebt > 0) {
    costOfDebt = (params.recentInterestExpense / params.recentDebt) * 100;
  }

  // Tax Rate approximation: Income Tax / Pretax Income
  let taxRate = isUS ? 21.0 : 22.0;
  if (params.recentIncomeTaxExpense > 0 && params.recentIncomeBeforeTax > 0) {
    taxRate = (params.recentIncomeTaxExpense / params.recentIncomeBeforeTax) * 100;
  }

  // Capital structure weights
  const marketCap = params.marketCap || 0;
  const totalCap = marketCap + params.recentDebt;
  const equityWeight = totalCap > 0 ? marketCap / totalCap : 1;
  const debtWeight = totalCap > 0 ? params.recentDebt / totalCap : 0;

  // Growth rates
  const histCagr = params.revenueCagr5Y ?? params.revenueCagr3Y ?? 5.0;
  const phase1Growth = Math.max(0, Math.min(histCagr, 20));
  const phase2Growth = phase1Growth * 0.6;
  const terminalGrowth = isUS ? 2.5 : 3.0;

  return {
    riskFreeRate,
    beta,
    equityRiskPremium,
    costOfDebt,
    taxRate,
    equityWeight,
    debtWeight,
    phase1Growth,
    phase2Growth,
    terminalGrowth,
  };
}

export function buildDCFInputs(params: {
  currentFCF: number;
  totalDebt: number;
  cashAndEquivalents: number;
  sharesOutstanding: number | null | undefined;
  marketCap: number | null | undefined;
  currentPrice: number;
}): DCFInputs {
  const shares =
    params.sharesOutstanding && params.sharesOutstanding > 0
      ? params.sharesOutstanding
      : (params.marketCap || 0) / (params.currentPrice || 1);

  return {
    currentFCF: params.currentFCF || 0,
    totalDebt: params.totalDebt || 0,
    cashAndEquivalents: params.cashAndEquivalents || 0,
    sharesOutstanding: shares > 0 ? shares : 0,
    currentPrice: params.currentPrice || 0,
  };
}

export async function computeCompositeScore(
  symbol: string,
  market: Market,
  options: CompositeScoreOptions = {}
): Promise<{
  score: CompositeScore;
  dcfResult: DCFResult | null;
}> {
  const historyMonths = options.historyMonths ?? 12;

  // 1) Technicals
  const history = await getHistoricalData(symbol, market, historyMonths);
  if (!history || history.length < 50) {
    throw new Error(`Insufficient historical data to compute technicals for ${symbol}`);
  }
  const indicators = calculateIndicators(history);
  const currentPrice = history[history.length - 1].close;

  // 2) Fundamentals (comprehensive)
  const analysis = await getComprehensiveAnalysis2(symbol, market);

  // 3) DCF (base case, optional)
  const recentInterestExpense = analysis.financials[0]?.interestExpense || 0;
  const recentDebt = analysis.balanceSheets[0]?.totalDebt || 0;
  const recentIncomeTaxExpense = analysis.financials[0]?.incomeTaxExpense || 0;
  const recentIncomeBeforeTax = analysis.financials[0]?.incomeBeforeTax || 0;

  const baseAssumptions = buildBaseDCFAssumptions({
    market,
    beta: analysis.fundamentals.beta,
    marketCap: analysis.fundamentals.marketCap,
    recentDebt,
    recentInterestExpense,
    recentIncomeTaxExpense,
    recentIncomeBeforeTax,
    revenueCagr5Y: analysis.cagr?.revenue5Y,
    revenueCagr3Y: analysis.cagr?.revenue3Y,
  });

  const dcfInputs = buildDCFInputs({
    currentFCF: analysis.fundamentals.freeCashFlow || 0,
    totalDebt: recentDebt,
    cashAndEquivalents: analysis.balanceSheets[0]?.cash || 0,
    sharesOutstanding: analysis.fundamentals.sharesOutstanding,
    marketCap: analysis.fundamentals.marketCap,
    currentPrice,
  });

  let dcfResult: DCFResult | null = null;
  let sensitivityMatrix = null;

  if (dcfInputs.currentFCF > 0 && dcfInputs.currentPrice > 0) {
    dcfResult = calculateDCF(baseAssumptions, dcfInputs);
    sensitivityMatrix = generateSensitivityMatrix(
      baseAssumptions,
      dcfInputs,
      [-2, -1, 0, 1, 2],
      [-1, -0.5, 0, 0.5, 1]
    );
  }

  // 4) Composite score
  const techScore = calculateTechnicalScore(indicators, currentPrice);
  const fundScore = calculateFundamentalScore(analysis.fundamentals, analysis.financials);
  const valScore = calculateValuationScore(dcfResult, sensitivityMatrix, currentPrice);

  const totalScore = techScore.total + fundScore.total + valScore.total;
  const recommendation = generateRecommendation(totalScore);
  const summary = generateSummaryText(symbol.toUpperCase(), totalScore, recommendation, techScore, fundScore, valScore);

  return {
    score: {
      symbol: symbol.toUpperCase(),
      market,
      totalScore,
      recommendation,
      summary,
      breakdown: {
        technical: techScore,
        fundamental: fundScore,
        valuation: valScore,
      },
    },
    dcfResult,
  };
}

