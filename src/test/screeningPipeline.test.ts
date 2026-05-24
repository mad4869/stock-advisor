import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { yf } from '@/lib/yahooFinance2';
import { historyCache, singleScreenerCache } from '@/lib/cache';

vi.mock('@/lib/yahooFinance2', () => ({
  yf: {
    chart: vi.fn(),
  },
  toYSymbol: (symbol: string, market: string) => {
    const clean = symbol.toUpperCase().replace('.JK', '').replace('.JKT', '').replace(/\s+/g, '').trim();
    return market === 'ID' ? `${clean}.JK` : clean;
  },
  getComprehensiveAnalysis2: vi.fn().mockResolvedValue({
    profile: { sector: 'Technology', industry: 'Software' },
    fundamentals: { currentRatio: 1.5, debtToEquity: 0.2 },
    dividend: { payoutRatio: 50 },
    financials: [],
    balanceSheets: [],
    cashFlows: [],
    analystRating: { buy: 1, hold: 0, sell: 0 }
  })
}));

describe('screeningPipeline', () => {
  const generateMockOHLCV = (count: number, volume: number = 2000000) => {
    const quotes = [];
    for (let i = 0; i < count; i++) {
      // Create a nice uptrend
      const price = 100 + i * 0.5;
      quotes.push({
        open: price,
        high: price + 1.5,
        low: price - 1.5,
        close: price + 0.2,
        volume: volume,
        adjclose: price + 0.2,
      });
    }
    return quotes;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    historyCache.clear();
    singleScreenerCache.clear();
  });

  it('should run full US screening and pass highly liquid uptrending stocks', async () => {
    const mockQuotes = generateMockOHLCV(100, 500000); // 500k volume (passes 100k floor)
    vi.mocked(yf.chart).mockResolvedValue({ quotes: mockQuotes } as any);

    const result = await runScreenerForSymbol('AAPL', 'US', 'DEFAULT');
    expect(result.symbol).toBe('AAPL');
    expect(result.market).toBe('US');
    expect(result.isPass).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.taScore).toBeGreaterThanOrEqual(60);
    expect(result.smartMoney?.isAccumulating).toBe(true);
  });

  it('should run full ID screening and fail stocks under the 1,000,000 ID volume floor', async () => {
    const mockQuotes = generateMockOHLCV(100, 500000); // 500k volume (fails 1M IDX floor)
    vi.mocked(yf.chart).mockResolvedValue({ quotes: mockQuotes } as any);

    const result = await runScreenerForSymbol('BBCA', 'ID', 'DEFAULT');
    expect(result.symbol).toBe('BBCA');
    expect(result.market).toBe('ID');
    expect(result.isPass).toBe(false);
    expect(result.error).toBe('Insufficient liquidity');
  });

  it('should run full ID screening and pass stocks above the 1,000,000 ID volume floor', async () => {
    const mockQuotes = generateMockOHLCV(100, 2500000); // 2.5M volume (passes 1M floor)
    vi.mocked(yf.chart).mockResolvedValue({ quotes: mockQuotes } as any);

    const result = await runScreenerForSymbol('BBCA', 'ID', 'DEFAULT');
    expect(result.symbol).toBe('BBCA');
    expect(result.market).toBe('ID');
    expect(result.isPass).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should early-exit Gate 1 and avoid calculating TA if accumulation fails', async () => {
    const quotes = [];
    for (let i = 0; i < 100; i++) {
      // downtrending price and negative CMF distribution signals
      const price = 200 - i * 0.5;
      quotes.push({
        open: price,
        high: price + 1,
        low: price - 1,
        close: price - 0.2,
        volume: 1000000,
        adjclose: price - 0.2,
      });
    }
    vi.mocked(yf.chart).mockResolvedValue({ quotes } as any);

    const result = await runScreenerForSymbol('BBCA', 'ID', 'DEFAULT');
    expect(result.isPass).toBe(false);
    expect(result.smartMoney?.isAccumulating).toBe(false);
    expect(result.taData).toBeNull(); // Gate 2 skipped
  });
});
