import { Market } from './index';
import { FundamentalData } from './screener';

// ====== Company Profile ======

export interface CompanyOfficer {
  name: string;
  title: string;
  age?: number;
}

export interface CompanyProfile {
  name: string;
  symbol: string;
  market: Market;
  sector: string;
  industry: string;
  description: string;
  website: string;
  officers: CompanyOfficer[];
  address: string;
  country: string;
  employeeCount: number | null;
}

// ====== Annual Financial Statements ======

export interface AnnualFinancials {
  year: string;          // e.g. "2024"
  endDate: string;       // ISO date
  totalRevenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ebit: number | null;
  eps: number | null;
  interestExpense: number | null;
  // Derived margins (computed from raw data)
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  
  // Tax & Debt calculation fields
  incomeBeforeTax?: number | null;
  incomeTaxExpense?: number | null;
  ebitda?: number | null;
}


export interface AnnualBalanceSheet {
  year: string;
  endDate: string;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  cash: number | null;
  goodwill: number | null;
  // Derived ratios
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
}

export interface AnnualCashFlow {
  year: string;
  endDate: string;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  dividendsPaid: number | null;
  depreciation?: number | null;
}

// ====== Dividend Info ======

export interface DividendInfo {
  dividendYield: number | null;       // %
  dividendRate: number | null;        // Annual per share
  payoutRatio: number | null;         // %
  exDividendDate: string | null;      // ISO date
  dividendDate: string | null;        // ISO date
  fiveYearAvgDividendYield: number | null;
}

// ====== Short Interest ======

export interface ShortInterestData {
  shortPercentOfFloat: number | null;  // 0–100 scale
  shortRatio: number | null;           // days to cover
  sharesShort: number | null;
  sharesShortPriorMonth: number | null;
  // Derived
  shortInterestRising: boolean | null; // sharesShort > sharesShortPriorMonth
}

// ====== EPS Revision ======

export interface EpsRevisionData {
  epsRevisionUp: boolean | null;     // true = estimate revised up vs 30d ago
  currentEstimate: number | null;    // current consensus EPS estimate
  thirtyDayAgoEstimate: number | null;
  revisionPercent: number | null;    // % change in estimate
}

// ====== Earnings Calendar ======

export interface EarningsCalendar {
  nextEarningsDate: string | null;   // ISO date
  daysToEarnings: number | null;     // business days until next earnings
  isEarningsImminent: boolean;       // true if within 7 calendar days
}

// ====== Analyst Upgrade/Downgrade History ======

export interface AnalystAction {
  firm: string;
  toGrade: string;
  fromGrade: string;
  action: 'upgrade' | 'downgrade' | 'init' | 'reit';
  date: string;   // ISO date
}

export interface UpgradeDowngradeHistory {
  recentActions: AnalystAction[];   // last 90 days
  upgradeCount30d: number;
  downgradeCount30d: number;
  netScore: number;                 // upgrades - downgrades in last 30 days
}

// ====== Red Flags ======

export type RedFlagSeverity = 'warning' | 'danger';

export interface RedFlag {
  id: string;
  title: string;
  message: string;
  severity: RedFlagSeverity;
  metric: string;
  currentValue: string;
  threshold: string;
}

// ====== Peer Comparison ======

export interface PeerData {
  symbol: string;
  name: string;
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  netProfitMargin: number | null;
  revenueGrowth: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  marketCap: number | null;
}

// ====== Valuation Thresholds ======

export type ThresholdLevel = 'good' | 'fair' | 'expensive';

export interface ValuationThresholds {
  peRatio: { good: number; fair: number };    // max for each level
  pbRatio: { good: number; fair: number };
  pegRatio: { good: number; fair: number };
  evToEbitda: { good: number; fair: number };
}

// US default thresholds
export const US_THRESHOLDS: ValuationThresholds = {
  peRatio: { good: 15, fair: 25 },
  pbRatio: { good: 1.5, fair: 3 },
  pegRatio: { good: 1.0, fair: 1.5 },
  evToEbitda: { good: 10, fair: 15 },
};

// IDX thresholds (generally lower multiples)
export const IDX_THRESHOLDS: ValuationThresholds = {
  peRatio: { good: 12, fair: 20 },
  pbRatio: { good: 1.2, fair: 2.5 },
  pegRatio: { good: 0.8, fair: 1.3 },
  evToEbitda: { good: 8, fair: 12 },
};

// ====== Insider Activity ======

export interface InsiderTransaction {
  filerName: string;
  filerRelation: string;
  shares: number;
  date: string; // ISO date (YYYY-MM-DD)
  transactionText: string; // e.g. Purchase, Sale, Option Exercise
}

export interface InsiderActivity {
  netSharesBought90d: number | null; // positive = net buying, negative = net selling
  buyShares90d: number | null;
  sellShares90d: number | null;
  recentTransactions: InsiderTransaction[]; // last 10 transactions
}

// ====== Fibonacci Retracement Levels ======

export interface FibonacciLevels {
  high: number;
  low: number;
  fib236: number;
  fib382: number;
  fib500: number;
  fib618: number;
  fib786: number;
}

// ====== Comprehensive Analysis ======

export interface ComprehensiveAnalysis {
  // Core identity
  profile: CompanyProfile;
  fundamentals: FundamentalData;

  // Enterprise value
  enterpriseValue: number | null;

  // Historical statements (oldest → newest)
  financials: AnnualFinancials[];
  balanceSheets: AnnualBalanceSheet[];
  cashFlows: AnnualCashFlow[];

  // Dividend
  dividend: DividendInfo;

  // Analyst consensus
  analystRating: {
    buy: number;
    hold: number;
    sell: number;
    targetMeanPrice: number | null;
    targetHighPrice: number | null;
    targetLowPrice: number | null;
  };

  // Computed metrics
  cagr: {
    revenue3Y: number | null;
    revenue5Y: number | null;
    eps3Y: number | null;
    eps5Y: number | null;
  };
  fcfMargin: number | null;      // FCF / Revenue
  fcfYield: number | null;       // FCF / MarketCap
  interestCoverage: number | null; // EBIT / Interest Expense
  debtToEbitda: number | null;

  // ── New enrichment fields ──────────────────────────────────────────

  /** Short interest data from defaultKeyStatistics */
  shortInterest: ShortInterestData;

  /** EPS revision direction vs 30 days ago */
  epsRevision: EpsRevisionData;

  /** Next earnings date and proximity warning */
  earningsCalendar: EarningsCalendar;

  /** Recent analyst upgrade/downgrade activity (last 90 days) */
  upgradeDowngrades: UpgradeDowngradeHistory;

  /** 52-week relative performance vs S&P 500 (US only) */
  relativeStrength52W: number | null;  // stock 52W change - S&P 52W change (pp)
  stock52WChange: number | null;       // stock 52W price change %

  /** Insider purchase and sale activity (US only) */
  insiderActivity?: InsiderActivity | null;

  /** 52-week low price */
  fiftyTwoWeekLow?: number | null;

  /** Calculated Fibonacci retracement levels based on 52W High and Low */
  fibonacciLevels?: FibonacciLevels | null;
}

// ====== API Response ======

export interface AnalysisResponse {
  analysis: ComprehensiveAnalysis;
  redFlags: RedFlag[];
  peers: PeerData[];
}
