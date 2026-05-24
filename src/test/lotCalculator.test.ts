import { describe, it, expect } from 'vitest';
import { calculateLots } from '@/lib/lotCalculator';

describe('lotCalculator', () => {
  describe('US market calculations', () => {
    it('should calculate max affordable shares (1 share per lot)', () => {
      const result = calculateLots('AAPL', 'US', 150, 10000);
      expect(result.sharesPerLot).toBe(1);
      expect(result.totalLots).toBe(66); // 10000 / 150 = 66.67 -> 66
      expect(result.totalShares).toBe(66);
      expect(result.totalCost).toBe(9900);
      expect(result.remainingFund).toBe(100);
    });

    it('should calculate risk-based position sizing when valid stop loss is provided', () => {
      // Risk 1% of 10000 = 100
      // Price = 100, Stop = 90 -> risk per share = 10
      // Max shares = 100 / 10 = 10
      const result = calculateLots('AAPL', 'US', 100, 10000, 1, 90);
      expect(result.recommendedLots).toBe(10);
      expect(result.maxLossAtStop).toBe(100);
    });
  });

  describe('ID market calculations', () => {
    it('should calculate max affordable lots (100 shares per lot)', () => {
      const result = calculateLots('BBCA', 'ID', 10000, 1500000);
      expect(result.sharesPerLot).toBe(100);
      expect(result.totalLots).toBe(1); // 1500000 / (10000 * 100) = 1.5 -> 1 lot
      expect(result.totalShares).toBe(100);
      expect(result.totalCost).toBe(1000000);
      expect(result.remainingFund).toBe(500000);
    });

    it('should calculate risk-based position sizing for IDX lot multiplier', () => {
      // Fund = Rp 100,000,000. Risk 1% = Rp 1,000,000
      // Entry = Rp 5,000. Stop = Rp 4,500. Risk per share = Rp 500.
      // Risk per lot = 500 * 100 = Rp 50,000.
      // Max lots = 1,000,000 / 50,000 = 20 lots.
      const result = calculateLots('BBCA', 'ID', 5000, 100000000, 1, 4500);
      expect(result.recommendedLots).toBe(20);
      expect(result.maxLossAtStop).toBe(1000000);
    });

    it('should round the stopLossPrice input to the nearest valid IDX tick size', () => {
      // Entry = Rp 5,200 (tick size for 5000+ is 25)
      // Stop = Rp 4,983 (4983 is in 2000-5000 range where tick size is 10)
      // 4983 rounded to nearest 10 is 4980.
      const result = calculateLots('BBCA', 'ID', 5200, 100000000, 1, 4983);
      expect(result.stopLossPrice).toBe(4980);
      
      // Stop = Rp 5,108 (5108 is in 5000+ range where tick size is 25)
      // 5108 rounded to nearest 25 is 5100.
      const result2 = calculateLots('BBCA', 'ID', 5200, 100000000, 1, 5108);
      expect(result2.stopLossPrice).toBe(5100);
    });

    it('should round the entryPrice input to the nearest valid IDX tick size', () => {
      // Entry = Rp 5004 (rounded to nearest 10 is Rp 5000)
      const result = calculateLots('BBCA', 'ID', 5004, 1000000);
      expect(result.price).toBe(5000);

      // Entry = Rp 7512 (rounded to nearest 25 is Rp 7500)
      const result2 = calculateLots('BBCA', 'ID', 7512, 1000000);
      expect(result2.price).toBe(7500);
    });
  });
});
