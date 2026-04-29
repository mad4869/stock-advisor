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
  price: number; // entry price used for sizing
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

  // Risk-based sizing (optional if stopLoss not provided)
  stopLossPrice?: number | null;
  riskPercent?: number | null;
  riskAmount?: number | null;
  riskPerShare?: number | null;
  maxLossAtStop?: number | null;

  // Optional sizing options
  strictRiskBasedOnly?: boolean | null;
  bufferPercent?: number | null;
  feePerShare?: number | null;
  effectiveRiskPerShare?: number | null;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  market: Market;
  name: string;
  buyPrice: number;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
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

// ====== Portfolio Types — Dual Currency ======

export interface MarketPnL {
  market: Market;
  currency: string;
  totalInvested: number;
  totalCurrentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positionCount: number;
  winnersCount: number;
  losersCount: number;
  winRate: number;
  bestPerformer: { symbol: string; pnlPercent: number } | null;
  worstPerformer: { symbol: string; pnlPercent: number } | null;
}

export interface PortfolioSnapshot {
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime
  us: MarketSnapshotData;
  id: MarketSnapshotData;
  positions: PositionSnapshot[];
}

export interface MarketSnapshotData {
  totalInvested: number;
  totalCurrentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positionCount: number;
}

export interface PositionSnapshot {
  symbol: string;
  market: Market;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface PortfolioSummary {
  us: MarketPnL;
  id: MarketPnL;
  totalPositions: number;
  totalRealizedPnL: {
    us: number;
    id: number;
  };
  overallWinRate: number;
}

export interface ClosedPosition {
  id: string;
  symbol: string;
  market: Market;
  name: string;
  buyPrice: number;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  buyDate: string;
  sellPrice: number;
  sellDate: string;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL';
  followedPlan?: boolean;
  planAnalysis?: string;
}