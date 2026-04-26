import { NextRequest, NextResponse } from 'next/server';
import { Market } from '@/types';
import { getHistoricalData } from '@/lib/stockData';
import { getComprehensiveAnalysis2 } from '@/lib/yahooFinance2';
import { calculateIndicators } from '@/lib/indicators';
import { calculateDCF, generateSensitivityMatrix, DCFInputs } from '@/lib/dcfCalculator';
import { DCFAssumptions } from '@/types/dcf';
import {
  calculateTechnicalScore,
  calculateFundamentalScore,
  calculateValuationScore,
  generateRecommendation,
  generateSummaryText,
} from '@/lib/scoringEngine';
import { CompositeScore } from '@/types/scoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const market = (searchParams.get('market') || 'US') as Market;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    // 1. Fetch Technical Data
    const history = await getHistoricalData(symbol, market, 12);
    if (!history || history.length < 50) {
      throw new Error(`Insufficient historical data to compute technicals for ${symbol}`);
    }
    const indicators = calculateIndicators(history);
    const currentPrice = history[history.length - 1].close;

    // 2. Fetch Fundamental Data
    const analysis = await getComprehensiveAnalysis2(symbol, market);

    // 3. Compute Base DCF Scenario
    const isUS = market === 'US';
    const riskFreeRate = isUS ? 4.3 : 6.8;
    const erp = isUS ? 5.5 : 7.0;
    const beta = analysis.fundamentals.beta || 1.0;
    
    // Cost of Debt approximation: Interest Expense / Total Debt
    let costOfDebt = 5.0; // Default
    const recentInterest = analysis.financials[0]?.interestExpense || 0;
    const recentDebt = analysis.balanceSheets[0]?.totalDebt || 0;
    if (recentInterest > 0 && recentDebt > 0) {
      costOfDebt = (recentInterest / recentDebt) * 100;
    }

    // Tax Rate approximation: Income Tax / Pretax Income
    let taxRate = isUS ? 21.0 : 22.0;
    const recentTax = analysis.financials[0]?.incomeTaxExpense || 0;
    const recentPretax = analysis.financials[0]?.incomeBeforeTax || 0;
    if (recentTax > 0 && recentPretax > 0) {
      taxRate = (recentTax / recentPretax) * 100;
    }

    // Weights
    const marketCap = analysis.fundamentals.marketCap || 0;
    const totalCap = marketCap + recentDebt;
    const equityWeight = totalCap > 0 ? marketCap / totalCap : 1;
    const debtWeight = totalCap > 0 ? recentDebt / totalCap : 0;

    // Growth rates
    const histCagr = analysis.cagr?.revenue5Y || analysis.cagr?.revenue3Y || 5.0;
    const phase1Growth = Math.max(0, Math.min(histCagr, 20)); // Cap between 0 and 20%
    const phase2Growth = phase1Growth * 0.6; // Deceleration
    const terminalGrowth = isUS ? 2.5 : 3.0;

    const baseAssumptions: DCFAssumptions = {
      riskFreeRate,
      beta,
      equityRiskPremium: erp,
      costOfDebt,
      taxRate,
      equityWeight,
      debtWeight,
      phase1Growth,
      phase2Growth,
      terminalGrowth,
    };

    const dcfInputs: DCFInputs = {
      currentFCF: analysis.fundamentals.freeCashFlow || 0,
      totalDebt: recentDebt,
      cashAndEquivalents: analysis.balanceSheets[0]?.cash || 0,
      sharesOutstanding: analysis.fundamentals.sharesOutstanding || (marketCap / currentPrice),
      currentPrice: currentPrice,
    };

    let dcfResult = null;
    let sensitivityMatrix = null;
    
    // Only calculate DCF if we have positive FCF, otherwise valuation is too speculative
    if (dcfInputs.currentFCF > 0) {
      dcfResult = calculateDCF(baseAssumptions, dcfInputs);
      sensitivityMatrix = generateSensitivityMatrix(
        baseAssumptions,
        dcfInputs,
        [-0.02, -0.01, 0, 0.01, 0.02],
        [-0.01, -0.005, 0, 0.005, 0.01]
      );
    }

    // 4. Execute Scoring Engine
    const techScore = calculateTechnicalScore(indicators, currentPrice);
    const fundScore = calculateFundamentalScore(analysis.fundamentals, analysis.financials);
    const valScore = calculateValuationScore(dcfResult, sensitivityMatrix, currentPrice);

    const totalScore = techScore.total + fundScore.total + valScore.total;
    const recommendation = generateRecommendation(totalScore);
    const summary = generateSummaryText(symbol, totalScore, recommendation, techScore, fundScore, valScore);

    const scoreData: CompositeScore = {
      symbol,
      market,
      totalScore,
      recommendation,
      summary,
      breakdown: {
        technical: techScore,
        fundamental: fundScore,
        valuation: valScore,
      }
    };

    return NextResponse.json({ score: scoreData });

  } catch (error: any) {
    console.error('[Score API Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute score' },
      { status: 500 }
    );
  }
}
