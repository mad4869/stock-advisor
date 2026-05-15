import { describe, it, expect } from 'vitest';
import { isBankingSector, isFinancialSector } from '@/lib/sectorUtils';

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
      expect(isBankingSector('Insurance')).toBe(false);
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

    it('handles unexpected casing', () => {
      expect(isFinancialSector('FINANCIAL')).toBe(true);
      expect(isFinancialSector('insurance')).toBe(true);
      expect(isFinancialSector('capital markets')).toBe(true);
    });

    it('returns false for non-financial sectors', () => {
      expect(isFinancialSector('Technology')).toBe(false);
      expect(isFinancialSector('Healthcare')).toBe(false);
      expect(isFinancialSector('Energy')).toBe(false);
      expect(isFinancialSector('Real Estate')).toBe(false);
    });

    it('handles null, undefined, and empty string', () => {
      expect(isFinancialSector(null)).toBe(false);
      expect(isFinancialSector(undefined as any)).toBe(false);
      expect(isFinancialSector('')).toBe(false);
    });

    it('detects banking sectors as financial', () => {
      expect(isFinancialSector('Banks—Regional')).toBe(true);
      expect(isFinancialSector('Banking')).toBe(true);
    });
  });
});
