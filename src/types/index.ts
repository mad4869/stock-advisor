export type Market = 'US' | 'ID';

export interface StockQuote {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high52Week?: number;
  low52Week?: number;
}

export interface HistoricalData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number | null;
  macd: {
    MACD: number;
    signal: number;
    histogram: number;
  } | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
  atr: number | null;
  stochastic: {
    k: number;
    d: number;
  } | null;
  adx: number | null;
  obvTrend: 'rising' | 'falling' | 'neutral';
}

export type Signal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface IndicatorSignal {
  name: string;
  value: string;
  signal: Signal;
  explanation: string;
  educationalInfo: string;
}

export interface StockRecommendation {
  stock: StockQuote;
  overallSignal: Signal;
  confidence: number;
  indicators: IndicatorSignal[];
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface LotCalculation {
  symbol: string;
  market: Market;
  price: number;
  currency: string;
  initialFund: number;
  lotSize: number;
  sharesPerLot: number;
  totalShares: number;
  totalLots: number;
  totalCost: number;
  remainingFund: number;
  positionPercent: number;
  recommendedLots: number;
  recommendedReason: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  market: Market;
  name: string;
  buyPrice: number;
  buyDate: string;
  quantity: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  action: Signal;
  actionReason: string;
  lastUpdated: string;
}

export interface PopularStock {
  symbol: string;
  name: string;
  market: Market;
  sector: string;
}