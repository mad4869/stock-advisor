import { describe, it, expect } from 'vitest';
import { isBankingSector, isFinancialSector } from './sectorUtils';

describe('sectorUtils', () => {
  describe('isBankingSector', () => {
    it('detects standard bank sectors', () => {
      expect(isBankingSector('Banks—Regional')).toBe(true);
      expect(isBankingSector('Banks—Diversified')).toBe(true);
      expect(isBankingSector('Diversified Financial Services')).toBe(true);
      expect(isBankingSector('Banking Services')).toBe(true);
    });

    it('handles unexpected casing', () => {
      expect(isBankingSector('BANKS')).toBe(true);
      expect(isBankingSector('financial services')).toBe(true);
      expect(isBankingSector('bAnKiNg')).toBe(true);
    });

    it('returns false for non-banking sectors', () => {
      expect(isBankingSector('Technology')).toBe(false);
      expect(isBankingSector('Insurance')).toBe(false); // Insurance is financial but not necessarily bank for our strict NPL rule
      expect(isBankingSector('Consumer Goods')).toBe(false);
    });

    it('handles null, undefined, and empty string', () => {
      expect(isBankingSector(null)).toBe(false);
      expect(isBankingSector(undefined as any)).toBe(false);
      expect(isBankingSector('')).toBe(false);
    });
  });

  describe('isFinancialSector', () => {
    it('detects broad financial sectors', () => {
      expect(isFinancialSector('Banks—Regional')).toBe(true);
      expect(isFinancialSector('Insurance—Life')).toBe(true);
      expect(isFinancialSector('Capital Markets')).toBe(true);
      expect(isFinancialSector('Credit Services')).toBe(true);
    });

    it('returns false for non-financial sectors', () => {
      expect(isFinancialSector('Technology')).toBe(false);
      expect(isFinancialSector('Healthcare')).toBe(false);
    });
  });
});
