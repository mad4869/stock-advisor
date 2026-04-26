import { Market } from './index';

// ====== Fundamental Data ======

export interface FundamentalData {
  symbol: string;
  name: string;
  market: Market;
  currency: string;

  // Valuation
  peRatio: number | null;         // Trailing P/E (TTM)
  forwardPE: number | null;       // Forward P/E
  pbRatio: number | null;         // Price/Book
  psRatio: number | null;         // Price/Sales
  pegRatio: number | null;        // PEG Ratio
  evToEbitda: number | null;      // EV/EBITDA

  // Profitability
  roe: number | null;             // Return on Equity (%)
  roa: number | null;             // Return on Assets (%)
  netProfitMargin: number | null; // Net Profit Margin (%)
  grossMargin: number | null;     // Gross Margin (%)
  operatingMargin: number | null; // Operating Margin (%)

  // Growth
  revenueGrowth: number | null;   // Revenue Growth YoY (%)
  earningsGrowth: number | null;  // Earnings Growth YoY (%)
  epsGrowthCurrentYear: number | null; // EPS Growth current year (%)
  epsGrowthNext5Y: number | null; // EPS Growth next 5Y annualized (%)

  // Financial Health
  debtToEquity: number | null;    // Debt/Equity ratio
  currentRatio: number | null;    // Current Ratio
  freeCashFlow: number | null;    // Free Cash Flow (absolute)

  // Income & Size
  dividendYield: number | null;   // Dividend Yield (%)
  payoutRatio: number | null;     // Payout Ratio (%)
  marketCap: number | null;       // Market Capitalization

  // Trading
  avgVolume3M: number | null;     // Average Volume (3 months)
  high52Week: number | null;      // 52-Week High
  low52Week: number | null;       // 52-Week Low
  beta: number | null;            // Beta

  // Current price info
  price: number | null;
  sharesOutstanding?: number | null; // Shares Outstanding for valuation
}

// ====== Screener Filter ======

export interface FilterRange {
  min?: number;
  max?: number;
}

export type ScreenerFilterKey = keyof Omit<
  FundamentalData,
  'symbol' | 'name' | 'market' | 'currency' | 'price'
>;

export type ScreenerFilters = Partial<Record<ScreenerFilterKey, FilterRange>>;

// ====== Screener Preset ======

export interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  filters: ScreenerFilters;
}

// ====== Screener Result ======

export interface ScreenerResult {
  stock: FundamentalData;
  matchedFilters: number;
  totalFilters: number;
  passRate: number; // 0-100
}

// ====== API Request/Response ======

export interface ScreenerRequest {
  market: Market;
  filters: ScreenerFilters;
  additionalSymbols?: string[]; // user-added tickers
}

export interface ScreenerResponse {
  results: ScreenerResult[];
  totalScreened: number;
  totalMatched: number;
  errors: string[];
}

// ====== Filter metadata for UI ======

export interface FilterMeta {
  key: ScreenerFilterKey;
  label: string;
  shortLabel: string;
  category: 'valuation' | 'profitability' | 'growth' | 'health' | 'income' | 'trading';
  suffix: string;        // e.g. 'x', '%', '$'
  description: string;
  step: number;
  goodDirection: 'lower' | 'higher' | 'neutral';
}

export const FILTER_METADATA: FilterMeta[] = [
  // Valuation
  { key: 'peRatio', label: 'P/E Ratio (TTM)', shortLabel: 'P/E', category: 'valuation', suffix: 'x', description: 'Price to earnings ratio', step: 1, goodDirection: 'lower' },
  { key: 'forwardPE', label: 'Forward P/E', shortLabel: 'Fwd P/E', category: 'valuation', suffix: 'x', description: 'Forward price to earnings', step: 1, goodDirection: 'lower' },
  { key: 'pbRatio', label: 'P/B Ratio', shortLabel: 'P/B', category: 'valuation', suffix: 'x', description: 'Price to book value', step: 0.1, goodDirection: 'lower' },
  { key: 'psRatio', label: 'P/S Ratio', shortLabel: 'P/S', category: 'valuation', suffix: 'x', description: 'Price to sales ratio', step: 0.1, goodDirection: 'lower' },
  { key: 'pegRatio', label: 'PEG Ratio', shortLabel: 'PEG', category: 'valuation', suffix: 'x', description: 'Price/earnings to growth', step: 0.1, goodDirection: 'lower' },
  { key: 'evToEbitda', label: 'EV/EBITDA', shortLabel: 'EV/EBITDA', category: 'valuation', suffix: 'x', description: 'Enterprise value to EBITDA', step: 1, goodDirection: 'lower' },

  // Profitability
  { key: 'roe', label: 'Return on Equity', shortLabel: 'ROE', category: 'profitability', suffix: '%', description: 'Return on equity', step: 1, goodDirection: 'higher' },
  { key: 'roa', label: 'Return on Assets', shortLabel: 'ROA', category: 'profitability', suffix: '%', description: 'Return on assets', step: 1, goodDirection: 'higher' },
  { key: 'netProfitMargin', label: 'Net Profit Margin', shortLabel: 'Net Margin', category: 'profitability', suffix: '%', description: 'Net profit margin', step: 1, goodDirection: 'higher' },
  { key: 'grossMargin', label: 'Gross Margin', shortLabel: 'Gross Margin', category: 'profitability', suffix: '%', description: 'Gross profit margin', step: 1, goodDirection: 'higher' },
  { key: 'operatingMargin', label: 'Operating Margin', shortLabel: 'Op Margin', category: 'profitability', suffix: '%', description: 'Operating profit margin', step: 1, goodDirection: 'higher' },

  // Growth
  { key: 'revenueGrowth', label: 'Revenue Growth (YoY)', shortLabel: 'Rev Growth', category: 'growth', suffix: '%', description: 'Year-over-year revenue growth', step: 1, goodDirection: 'higher' },
  { key: 'earningsGrowth', label: 'Earnings Growth (YoY)', shortLabel: 'Earn Growth', category: 'growth', suffix: '%', description: 'Year-over-year earnings growth', step: 1, goodDirection: 'higher' },
  { key: 'epsGrowthCurrentYear', label: 'EPS Growth (Current Year)', shortLabel: 'EPS CY', category: 'growth', suffix: '%', description: 'EPS growth estimate for current year', step: 1, goodDirection: 'higher' },
  { key: 'epsGrowthNext5Y', label: 'EPS Growth (Next 5Y)', shortLabel: 'EPS 5Y', category: 'growth', suffix: '%', description: 'Annualized EPS growth estimate next 5 years', step: 1, goodDirection: 'higher' },

  // Financial Health
  { key: 'debtToEquity', label: 'Debt-to-Equity', shortLabel: 'D/E', category: 'health', suffix: 'x', description: 'Total debt to equity ratio', step: 0.1, goodDirection: 'lower' },
  { key: 'currentRatio', label: 'Current Ratio', shortLabel: 'Curr Ratio', category: 'health', suffix: 'x', description: 'Current assets / current liabilities', step: 0.1, goodDirection: 'higher' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', shortLabel: 'FCF', category: 'health', suffix: '', description: 'Free cash flow', step: 1000000, goodDirection: 'higher' },

  // Income
  { key: 'dividendYield', label: 'Dividend Yield', shortLabel: 'Div Yield', category: 'income', suffix: '%', description: 'Annual dividend yield', step: 0.5, goodDirection: 'higher' },
  { key: 'payoutRatio', label: 'Payout Ratio', shortLabel: 'Payout', category: 'income', suffix: '%', description: 'Dividend payout ratio', step: 5, goodDirection: 'neutral' },
  { key: 'marketCap', label: 'Market Cap', shortLabel: 'Mkt Cap', category: 'income', suffix: '', description: 'Market capitalization', step: 1000000000, goodDirection: 'neutral' },

  // Trading
  { key: 'avgVolume3M', label: 'Avg Volume (3M)', shortLabel: 'Avg Vol', category: 'trading', suffix: '', description: 'Average daily volume (3 months)', step: 100000, goodDirection: 'neutral' },
  { key: 'high52Week', label: '52-Week High', shortLabel: '52W High', category: 'trading', suffix: '', description: '52-week high price', step: 1, goodDirection: 'neutral' },
  { key: 'low52Week', label: '52-Week Low', shortLabel: '52W Low', category: 'trading', suffix: '', description: '52-week low price', step: 1, goodDirection: 'neutral' },
  { key: 'beta', label: 'Beta', shortLabel: 'Beta', category: 'trading', suffix: '', description: 'Stock beta (volatility vs market)', step: 0.1, goodDirection: 'neutral' },
];
