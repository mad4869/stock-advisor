import { describe, it, expect } from 'vitest';
import { computeAccumulation } from '@/lib/accumulationProxy';

describe('accumulationProxy', () => {
  const generateNeutralData = (count: number) => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000
      });
    }
    return data;
  };

  describe('insufficient data', () => {
    it('should return default result for insufficient data', () => {
      const history = generateNeutralData(20);
      const result = computeAccumulation(history);
      expect(result.isAccumulating).toBe(false);
      expect(result.accumulationScore).toBe(0);
      expect(result.signalCount).toBe(0);
      expect(result.totalSignals).toBe(5);
      expect(result.logs[0]).toContain('Insufficient data');
    });

    it('should return default result for empty array', () => {
      const result = computeAccumulation([]);
      expect(result.isAccumulating).toBe(false);
      expect(result.accumulationScore).toBe(0);
    });

    it('should filter out invalid bars with zero/negative values', () => {
      const history = [
        ...generateNeutralData(40),
        { open: 0, high: 101, low: 99, close: 100, volume: 1000 },
        { open: -1, high: 101, low: 99, close: 100, volume: 1000 },
      ];
      const result = computeAccumulation(history);
      expect(result.isAccumulating).toBe(false);
    });
  });

  describe('accumulation detection', () => {
    it('should detect strong accumulation', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        history.push({
          open: 100 + i,
          high: 105 + i,
          low: 100 + i,
          close: 104 + i,
          volume: 2000 + i * 10
        });
      }
      const result = computeAccumulation(history);
      expect(result.accumulationScore).toBeGreaterThanOrEqual(60);
      expect(result.cmfBullish).toBe(true);
      expect(result.adTrendBullish).toBe(true);
      expect(result.isAccumulating).toBe(true);
    });

    it('should detect distribution (selling pressure)', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        history.push({
          open: 200 - i,
          high: 200 - i,
          low: 195 - i,
          close: 196 - i,
          volume: 2000 + i * 10
        });
      }
      const result = computeAccumulation(history);
      expect(result.cmfBullish).toBe(false);
      expect(result.adTrendBullish).toBe(false);
    });
  });

  describe('OBV divergence', () => {
    it('should detect OBV divergence (Price flat, OBV rising)', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        history.push({
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000
        });
      }
      
      for (let i = 30; i < 40; i++) {
        history[i].close = 100 + (i - 29) * 0.01;
        history[i].volume = 5000;
      }

      const result = computeAccumulation(history);
      expect(result.obvDivergence).toBe(true);
    });
  });

  describe('large block detection', () => {
    it('should detect large blocks', () => {
      const history = generateNeutralData(40);
      history[35] = { open: 100, high: 105, low: 100, close: 104, volume: 4000 };
      history[38] = { open: 100, high: 105, low: 100, close: 104, volume: 4000 };

      const result = computeAccumulation(history);
      expect(result.largeBlockBuying).toBe(true);
    });

    it('should not detect large blocks with normal volume', () => {
      const history = generateNeutralData(40);
      const result = computeAccumulation(history);
      expect(result.largeBlockBuying).toBe(false);
    });
  });

  describe('volume profile', () => {
    it('should calculate volume profile correctly for bullish case', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        const isUp = i % 2 === 0;
        history.push({
          open: 100,
          high: 102,
          low: 98,
          close: isUp ? 101 : 99,
          volume: isUp ? 2000 : 500
        });
      }
      const result = computeAccumulation(history);
      expect(result.volumeProfileBullish).toBe(true);
    });

    it('should calculate volume profile correctly for bearish case', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        const isUp = i % 2 === 0;
        history.push({
          open: 100,
          high: 102,
          low: 98,
          close: isUp ? 101 : 99,
          volume: isUp ? 500 : 2000
        });
      }
      const result = computeAccumulation(history);
      expect(result.volumeProfileBullish).toBe(false);
    });
  });

  describe('custom threshold', () => {
    it('should respect custom threshold parameter', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        history.push({
          open: 100,
          high: 102,
          low: 99,
          close: 101 + (i * 0.1),
          volume: 1500
        });
      }
      
      const resultWithLowThreshold = computeAccumulation(history, 20);
      const resultWithHighThreshold = computeAccumulation(history, 100);
      
      expect(resultWithLowThreshold.isAccumulating).toBe(true);
      expect(resultWithHighThreshold.isAccumulating).toBe(false);
    });
  });

  describe('CMF calculation', () => {
    it('should return CMF value between -1 and 1', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        history.push({
          open: 100 + i,
          high: 105 + i,
          low: 95 + i,
          close: 100 + i,
          volume: 1000
        });
      }
      const result = computeAccumulation(history);
      expect(result.cmf).toBeGreaterThanOrEqual(-1);
      expect(result.cmf).toBeLessThanOrEqual(1);
    });
  });

  describe('logs', () => {
    it('should generate meaningful logs for each signal', () => {
      const history = [];
      for (let i = 0; i < 40; i++) {
        history.push({
          open: 100 + i,
          high: 105 + i,
          low: 100 + i,
          close: 104 + i,
          volume: 2000 + i * 10
        });
      }
      const result = computeAccumulation(history);
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.some(log => log.includes('A/D Line'))).toBe(true);
      expect(result.logs.some(log => log.includes('CMF'))).toBe(true);
      expect(result.logs.some(log => log.includes('Volume Profile'))).toBe(true);
      expect(result.logs.some(log => log.includes('OBV Divergence'))).toBe(true);
      expect(result.logs.some(log => log.includes('Large Blocks'))).toBe(true);
      expect(result.logs.some(log => log.includes('Smart Money'))).toBe(true);
    });
  });
});
