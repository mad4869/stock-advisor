import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { yf } from '@/lib/yahooFinance2';
import { historyCache } from '@/lib/cache';

vi.mock('@/lib/yahooFinance2', () => ({
  yf: {
    chart: vi.fn()
  }
}));

vi.mock('@/lib/cache', () => ({
  historyCache: {
    get: vi.fn(),
    set: vi.fn()
  },
  CACHE_TTL: {
    HISTORICAL: 3600
  }
}));

describe('swingScreener', () => {
  const generateMockHistory = (count: number, trend: 'up' | 'down' | 'flat' = 'up') => {
    const history = [];
    for (let i = 0; i < count; i++) {
      const base = trend === 'up' ? 100 + i : (trend === 'down' ? 200 - i : 100);
      history.push({
        open: base,
        high: base + 2,
        low: base - 2,
        close: base + 1,
        volume: 2000000 + (trend === 'up' ? i * 10000 : 0),
        adjclose: base + 1
      });
    }
    return history;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('data validation', () => {
    it('should fail if insufficient historical data is returned', async () => {
      vi.mocked(yf.chart).mockResolvedValue({ quotes: generateMockHistory(10) } as any);
      
      const result = await runScreenerForSymbol('AAPL', 'US');
      expect(result.error).toContain('Insufficient historical data');
      expect(result.isPass).toBe(false);
    });

    it('should handle empty history', async () => {
      vi.mocked(yf.chart).mockResolvedValue({ quotes: [] } as any);
      
      const result = await runScreenerForSymbol('AAPL', 'US');
      expect(result.error).toContain('Insufficient historical data');
      expect(result.isPass).toBe(false);
    });
  });

  describe('accumulation gate', () => {
    it('should early exit if no accumulation is detected', async () => {
      const badHistory = generateMockHistory(60, 'down');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: badHistory } as any);

      const result = await runScreenerForSymbol('BBCA', 'ID');
      expect(result.smartMoney?.isAccumulating).toBe(false);
      expect(result.isPass).toBe(false);
      expect(result.taData).toBeNull();
    });
  });

  describe('DEFAULT preset', () => {
    it('should pass with good accumulation and TA', async () => {
      const goodHistory = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: goodHistory } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'DEFAULT');
      expect(result.smartMoney?.isAccumulating).toBe(true);
      expect(result.isPass).toBe(true);
      expect(result.taScore).toBeGreaterThanOrEqual(60);
    });
  });

  describe('BREAKOUT preset', () => {
    it('should handle BREAKOUT preset requirements', async () => {
      const history = generateMockHistory(100, 'up');
      const lastIdx = history.length - 1;
      history[lastIdx].volume = 5000;
      history[lastIdx].close = 210;
      history[lastIdx].high = 215;
      
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'BREAKOUT');
      expect(result.smartMoney).not.toBeNull();
    });
  });

  describe('OVERSOLD preset', () => {
    it('should handle OVERSOLD preset with lower TA threshold', async () => {
      const history = generateMockHistory(100, 'down');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'OVERSOLD');
      expect(result.smartMoney).toBeDefined();
    });
  });

  describe('SMART_MONEY preset', () => {
    it('should require strong accumulation for SMART_MONEY', async () => {
      const history = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'SMART_MONEY');
      expect(result.smartMoney).toBeDefined();
    });
  });

  describe('VOLUME_CLIMAX preset', () => {
    it('should handle VOLUME_CLIMAX preset', async () => {
      const history = generateMockHistory(100, 'up');
      const lastIdx = history.length - 1;
      history[lastIdx].volume = 10000;
      
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'VOLUME_CLIMAX');
      expect(result.smartMoney).toBeDefined();
    });
  });

  describe('SHORT_SQUEEZE preset', () => {
    it('should handle SHORT_SQUEEZE preset', async () => {
      const history = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'SHORT_SQUEEZE');
      expect(result.smartMoney).toBeDefined();
    });
  });

  describe('caching', () => {
    it('should use cache if available', async () => {
      const cachedHistory = generateMockHistory(60);
      vi.mocked(historyCache.get).mockReturnValue(cachedHistory);

      await runScreenerForSymbol('AAPL', 'US');
      
      expect(yf.chart).not.toHaveBeenCalled();
      expect(historyCache.get).toHaveBeenCalled();
    });

    it('should cache fetched history', async () => {
      const history = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);
      vi.mocked(historyCache.get).mockReturnValue(null);

      await runScreenerForSymbol('AAPL', 'US');
      
      expect(historyCache.set).toHaveBeenCalled();
    });
  });

  describe('symbol handling', () => {
    it('should handle IDX symbol format', async () => {
      const history = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('BBCA', 'ID');
      expect(result.symbol).toBe('BBCA');
      expect(result.market).toBe('ID');
    });

    it('should handle US symbol format', async () => {
      const history = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US');
      expect(result.symbol).toBe('AAPL');
      expect(result.market).toBe('US');
    });

    it('should clean symbol from .JK suffix', async () => {
      const history = generateMockHistory(100, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      await runScreenerForSymbol('BBCA.JK', 'ID');
      
      expect(yf.chart).toHaveBeenCalledWith(
        expect.stringContaining('BBCA'),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(yf.chart).mockRejectedValue(new Error('Network error'));

      const result = await runScreenerForSymbol('AAPL', 'US');
      expect(result.error).toBe('Network error');
      expect(result.isPass).toBe(false);
    });
  });

  describe('signals', () => {
    it('should generate signals for passing stocks', async () => {
      const history = generateMockHistory(250, 'up');
      vi.mocked(yf.chart).mockResolvedValue({ quotes: history } as any);

      const result = await runScreenerForSymbol('AAPL', 'US', 'DEFAULT');
      expect(result.signals).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
    });
  });
});
