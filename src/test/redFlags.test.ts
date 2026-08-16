import { describe, it, expect } from 'vitest';
import { detectRedFlags } from '@/lib/redFlags';
import { ComprehensiveAnalysis } from '@/types/analysis';

function createMockAnalysis(overrides: Partial<ComprehensiveAnalysis> = {}): ComprehensiveAnalysis {
  return {
    profile: {
      name: 'Test Corp',
      symbol: 'TEST',
      market: 'US',
      sector: 'Technology',
      industry: 'Software',
      description: 'Test business',
      website: 'https://test.com',
      officers: [],
      address: '123 St',
      country: 'US',
      employeeCount: 100,
    },
    fundamentals: {
      symbol: 'TEST',
      name: 'Test Corp',
      market: 'US',
      currency: 'USD',
      sector: 'Technology',
      peRatio: 15,
      forwardPE: 12,
      pbRatio: 2,
      psRatio: 1.5,
      pegRatio: 1,
      evToEbitda: 8,
      roe: 15,
      roa: 8,
      netProfitMargin: 10,
      grossMargin: 40,
      operatingMargin: 15,
      revenueGrowth: 5,
      earningsGrowth: 8,
      epsGrowthCurrentYear: 10,
      epsGrowthNext5Y: 8,
      debtToEquity: 0.5,
      currentRatio: 1.5,
      freeCashFlow: 1000000,
      dividendYield: 2,
      payoutRatio: 40,
      marketCap: 100000000,
      avgVolume3M: 500000,
      high52Week: 120,
      low52Week: 80,
      beta: 1.1,
      price: 100,
      sharesOutstanding: 1000000,
      npl: null,
      car: null,
    },
    enterpriseValue: 120000000,
    financials: [
      {
        year: '2022',
        endDate: '2022-12-31',
        totalRevenue: 10000000,
        grossProfit: 4000000,
        operatingIncome: 1500000,
        netIncome: 1000000,
        ebit: 1500000,
        ebitda: 2000000,
        eps: 1,
        interestExpense: 200000,
        grossMargin: 40,
        operatingMargin: 15,
        netMargin: 10,
      },
      {
        year: '2023',
        endDate: '2023-12-31',
        totalRevenue: 12000000,
        grossProfit: 4800000,
        operatingIncome: 1800000,
        netIncome: 1200000,
        ebit: 1800000,
        ebitda: 2400000,
        eps: 1.2,
        interestExpense: 250000,
        grossMargin: 40,
        operatingMargin: 15,
        netMargin: 10,
      },
    ],
    balanceSheets: [
      {
        year: '2022',
        endDate: '2022-12-31',
        totalAssets: 20000000,
        totalLiabilities: 10000000,
        totalEquity: 10000000,
        totalDebt: 5000000,
        shortTermDebt: 1000000,
        longTermDebt: 4000000,
        currentAssets: 6000000,
        currentLiabilities: 4000000,
        cash: 2000000,
        goodwill: 1000000,
        debtToEquity: 0.5,
        currentRatio: 1.5,
        quickRatio: 1.2,
      },
      {
        year: '2023',
        endDate: '2023-12-31',
        totalAssets: 24000000,
        totalLiabilities: 12000000,
        totalEquity: 12000000,
        totalDebt: 6000000,
        shortTermDebt: 1200000,
        longTermDebt: 4800000,
        currentAssets: 7200000,
        currentLiabilities: 4800000,
        cash: 2400000,
        goodwill: 1200000,
        debtToEquity: 0.5,
        currentRatio: 1.5,
        quickRatio: 1.2,
      },
    ],
    cashFlows: [
      {
        year: '2022',
        endDate: '2022-12-31',
        operatingCashFlow: 2000000,
        capitalExpenditure: 1000000,
        freeCashFlow: 1000000,
        dividendsPaid: 400000,
      },
      {
        year: '2023',
        endDate: '2023-12-31',
        operatingCashFlow: 2400000,
        capitalExpenditure: 1200000,
        freeCashFlow: 1200000,
        dividendsPaid: 480000,
      },
    ],
    dividend: {
      dividendYield: 2,
      dividendRate: 2,
      payoutRatio: 40,
      exDividendDate: '2023-11-15',
      dividendDate: '2023-12-15',
      fiveYearAvgDividendYield: 1.8,
      dividendFrequency: 4,
      dividendFrequencyLabel: 'Quarterly (4×/yr)',
    },
    analystRating: {
      buy: 8,
      hold: 2,
      sell: 0,
      targetMeanPrice: 115,
      targetHighPrice: 130,
      targetLowPrice: 100,
    },
    cagr: {
      revenue3Y: 10,
      revenue5Y: 9,
      eps3Y: 12,
      eps5Y: 11,
    },
    fcfMargin: 10,
    fcfYield: 1.2,
    interestCoverage: 7.2,
    debtToEbitda: 2.5,
    shortInterest: {
      shortPercentOfFloat: null,
      shortRatio: null,
      sharesShort: null,
      sharesShortPriorMonth: null,
      shortInterestRising: null,
    },
    epsRevision: {
      epsRevisionUp: null,
      currentEstimate: null,
      thirtyDayAgoEstimate: null,
      revisionPercent: null,
    },
    earningsCalendar: {
      nextEarningsDate: null,
      daysToEarnings: null,
      isEarningsImminent: false,
    },
    upgradeDowngrades: {
      upgradeCount30d: 0,
      downgradeCount30d: 0,
      netScore: 0,
      recentActions: [],
    },
    relativeStrength52W: null,
    stock52WChange: null,
    ...overrides,
  };
}

describe('redFlags', () => {
  it('should pass healthy companies without red flags', () => {
    const analysis = createMockAnalysis();
    const flags = detectRedFlags(analysis);
    expect(flags.length).toBe(0);
  });

  it('should detect declining FCF while revenue grows YoY', () => {
    const analysis = createMockAnalysis();
    // Revenue goes up: 10M -> 12M
    // FCF goes down: 1M -> 800k
    analysis.cashFlows[1].freeCashFlow = 800000;
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'revenue-up-fcf-down');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('warning');
  });

  it('should detect spikes in Debt-to-Equity (>50% YoY)', () => {
    const analysis = createMockAnalysis();
    // DE goes up: 0.5x -> 0.8x (60% YoY increase)
    analysis.balanceSheets[1].debtToEquity = 0.8;
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'de-spike');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('danger');
  });

  it('should detect negative free cash flow', () => {
    const analysis = createMockAnalysis();
    analysis.cashFlows[1].freeCashFlow = -500000;
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'negative-fcf');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('danger');
  });

  it('should detect unsustainable dividend payout ratio (>90%)', () => {
    const analysis = createMockAnalysis();
    analysis.dividend.payoutRatio = 95;
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'high-payout');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('warning');
  });

  it('should detect gross margin declining for 3 consecutive years', () => {
    const analysis = createMockAnalysis();
    analysis.financials = [
      { ...analysis.financials[0], year: '2021', grossMargin: 45 },
      { ...analysis.financials[0], year: '2022', grossMargin: 42 },
      { ...analysis.financials[1], year: '2023', grossMargin: 38 },
    ];
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'declining-gross-margin');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('warning');
  });

  it('should detect Return on Equity declining for 3 consecutive years (matching by year)', () => {
    const analysis = createMockAnalysis();
    analysis.financials = [
      { ...analysis.financials[0], year: '2021', netIncome: 1500000 }, // ROE = 1500000/10000000 = 15%
      { ...analysis.financials[0], year: '2022', netIncome: 1200000 }, // ROE = 1200000/10000000 = 12%
      { ...analysis.financials[1], year: '2023', netIncome: 1000000 }, // ROE = 1000000/12000000 = 8.3%
    ];
    analysis.balanceSheets = [
      { ...analysis.balanceSheets[0], year: '2021', totalEquity: 10000000 },
      { ...analysis.balanceSheets[0], year: '2022', totalEquity: 10000000 },
      { ...analysis.balanceSheets[1], year: '2023', totalEquity: 12000000 },
    ];
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'declining-roe');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('warning');
  });

  it('should detect liquidity risk (Current Ratio < 1.0)', () => {
    const analysis = createMockAnalysis();
    analysis.fundamentals.currentRatio = 0.85;
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'low-current-ratio');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('danger');
  });

  it('should detect low interest coverage (< 2.0x)', () => {
    const analysis = createMockAnalysis();
    analysis.interestCoverage = 1.5;
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'low-interest-coverage');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('danger');
  });

  it('should detect high goodwill risk (>50% of assets)', () => {
    const analysis = createMockAnalysis();
    analysis.balanceSheets[1].goodwill = 13000000;
    analysis.balanceSheets[1].totalAssets = 24000000; // goodwill ratio = 13/24 = 54%
    
    const flags = detectRedFlags(analysis);
    const target = flags.find(f => f.id === 'high-goodwill');
    expect(target).toBeDefined();
    expect(target?.severity).toBe('warning');
  });
});
