import { describe, it, expect } from 'vitest';
import { calculateTA } from '@/lib/technicalIndicators';

describe('technicalIndicators', () => {
  const generateMockData = (count: number) => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
        volume: 1000 + i * 10,
        date: new Date(2023, 0, i + 1).toISOString()
      });
    }
    return data;
  };

  describe('insufficient data', () => {
    it('should return null if history is less than 20 points', () => {
      const history = generateMockData(19);
      const result = calculateTA(history);
      expect(result).toBeNull();
    });

    it('should return null for empty array', () => {
      const result = calculateTA([]);
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = calculateTA(null as any);
      expect(result).toBeNull();
    });
  });

  describe('data filtering', () => {
    it('should filter out invalid data points', () => {
      const history = generateMockData(25);
      history[10].close = 0;
      history[11].high = null;
      
      const result = calculateTA(history);
      expect(result).not.toBeNull();
      expect(result?.close).toBe(124);
    });

    it('should return null if all data is invalid', () => {
      const history = generateMockData(25);
      for (let i = 0; i < history.length; i++) {
        history[i].close = 0;
      }
      const result = calculateTA(history);
      expect(result).toBeNull();
    });
  });

  describe('basic TA calculations', () => {
    it('should calculate basic TA indicators correctly', () => {
      const history = generateMockData(250);
      const result = calculateTA(history);

      expect(result).not.toBeNull();
      expect(result?.ema20).toBeDefined();
      expect(result?.ema50).toBeDefined();
      expect(result?.ema200).toBeDefined();
      expect(result?.rsi).toBeGreaterThanOrEqual(0);
      expect(result?.rsi).toBeLessThanOrEqual(100);
    });

    it('should calculate MACD histogram', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.macdHistogram).toBeDefined();
      expect(result?.macdIncreasing).toBeDefined();
    });

    it('should calculate ADX', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.adx).toBeDefined();
      expect(result?.adx).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pivot points', () => {
    it('should calculate pivot points correctly', () => {
      const history = [
        ...generateMockData(20),
        { open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { open: 105, high: 108, low: 104, close: 107, volume: 1100 }
      ];
      
      const result = calculateTA(history);
      expect(result?.pivotS1).toBeCloseTo(93.333, 2);
      expect(result?.distanceToS1).toBeGreaterThan(0);
      expect(result?.pivotR1).toBeCloseTo(113.333, 2);
      expect(result?.distanceToR1).toBeGreaterThan(0);
    });
  });

  describe('supertrend', () => {
    it('should detect bullish supertrend in uptrend', () => {
      const bullishHistory = [];
      for (let i = 0; i < 50; i++) {
        bullishHistory.push({
          open: 100 + i,
          high: 105 + i,
          low: 98 + i,
          close: 102 + i,
          volume: 1000
        });
      }
      const result = calculateTA(bullishHistory);
      expect(result?.supertrendBullish).toBe(true);
    });

    it('should detect bearish supertrend after sharp drop', () => {
      const crossoverHistory = [];
      for (let i = 0; i < 50; i++) {
        crossoverHistory.push({
          open: 100 + i, high: 105 + i, low: 98 + i, close: 102 + i, volume: 1000
        });
      }
      const lastPrice = 102 + 49;
      for (let i = 0; i < 10; i++) {
        crossoverHistory.push({
          open: lastPrice - i*10, 
          high: lastPrice - i*10 + 2, 
          low: lastPrice - i*10 - 20, 
          close: lastPrice - i*10 - 15, 
          volume: 1000
        });
      }
      const result = calculateTA(crossoverHistory);
      expect(result?.supertrendBullish).toBe(false);
    });
  });

  describe('stochastic', () => {
    it('should calculate stochastic K and D', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.stochK).toBeDefined();
      expect(result?.stochD).toBeDefined();
      expect(result?.stochK).toBeGreaterThanOrEqual(0);
      expect(result?.stochK).toBeLessThanOrEqual(100);
    });

    it('should detect stochastic recovery', () => {
      const history = [];
      for (let i = 0; i < 100; i++) {
        history.push({
          open: 100,
          high: 102,
          low: 95,
          close: 96,
          volume: 1000
        });
      }
      history[98].close = 98;
      history[99].close = 100;
      
      const result = calculateTA(history);
      expect(result?.stochRecovery).toBeDefined();
    });
  });

  describe('volume indicators', () => {
    it('should calculate volume 20-day average', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.volume20Avg).toBeDefined();
      expect(result?.volume20Avg).toBeGreaterThan(0);
    });

    it('should calculate volume ratio', () => {
      const history = generateMockData(100);
      history[99].volume = 5000;
      const result = calculateTA(history);
      expect(result?.volumeRatio).toBeDefined();
      expect(result?.volumeRatio).toBeGreaterThan(1);
    });

    it('should calculate OBV trend', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.obvTrendPositive).toBeDefined();
    });

    it('should calculate MFI', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.mfi).toBeDefined();
      expect(result?.mfi).toBeGreaterThanOrEqual(0);
      expect(result?.mfi).toBeLessThanOrEqual(100);
    });
  });

  describe('volatility indicators', () => {
    it('should calculate ATR percentage', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.atrPercent).toBeDefined();
      expect(result?.atrPercent).toBeGreaterThan(0);
    });

    it('should calculate Bollinger %B', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.bollingerB).toBeDefined();
    });
  });

  describe('52-week high', () => {
    it('should calculate 52-week high and distance', () => {
      const history = generateMockData(252);
      const result = calculateTA(history);
      expect(result?.fiftyTwoWeekHigh).toBeDefined();
      expect(result?.distanceTo52wHigh).toBeDefined();
      expect(result?.distanceTo52wHigh).toBeGreaterThanOrEqual(0);
    });

    it('should handle less than 252 days of data', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.fiftyTwoWeekHigh).toBeDefined();
    });
  });

  describe('CCI', () => {
    it('should calculate CCI', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result?.cci).toBeDefined();
    });
  });

  describe('trend crossover recency', () => {
    it('should calculate trend crossover recency metrics', () => {
      const history = generateMockData(100);
      const result = calculateTA(history);
      expect(result).toHaveProperty('emaCrossoverRecency');
      expect(result).toHaveProperty('priceCrossoverRecency');
      expect(result).toHaveProperty('macdCrossoverRecency');
    });
  });
});
