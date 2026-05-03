import { describe, it, expect } from 'vitest';
import { calculateFCDSTScore } from './fcdstEngine';
import { FundamentalData } from '@/types/screener';
import { DEFAULT_FCDST_THRESHOLDS, FCDSTThresholds } from '@/types/fcdst';

describe('fcdstEngine', () => {
  const baseData: FundamentalData = {
    symbol: 'TEST',
    name: 'Test Corp',
    market: 'US',
    currency: 'USD',
    price: 100,
    peRatio: null,
    forwardPE: null,
    pbRatio: null,
    psRatio: null,
    pegRatio: null,
    evToEbitda: null,
    roe: null,
    roa: null,
    netProfitMargin: null,
    grossMargin: null,
    operatingMargin: null,
    revenueGrowth: null,
    earningsGrowth: null,
    epsGrowthCurrentYear: null,
    epsGrowthNext5Y: null,
    debtToEquity: null,
    currentRatio: null,
    freeCashFlow: null,
    dividendYield: null,
    payoutRatio: null,
    marketCap: null,
    avgVolume3M: null,
    high52Week: null,
    low52Week: null,
    beta: null,
    interestCoverage: null,
    npl: null,
    car: null,
  };

  it('calculates F score correctly with mixed values', () => {
    const data: FundamentalData = {
      ...baseData,
      revenueGrowth: 20, // Pass (>=15)
      earningsGrowth: 10, // Fail (>=15)
      roe: 18, // Pass (>=15)
      netProfitMargin: 12, // Pass (>=10)
      grossMargin: 15, // Fail (>=20)
      freeCashFlow: 100, // Pass bonus (>0)
    };
    
    const result = calculateFCDSTScore(data);
    expect(result.fScore).toBe(4); // 3 main + 1 bonus
    expect(result.fDetails.revenueGrowth).toBe(true);
    expect(result.fDetails.netIncomeGrowth).toBe(false);
    expect(result.fDetails.bonusFcfPass).toBe(true);
  });

  it('calculates C score correctly with mixed values', () => {
    const data: FundamentalData = {
      ...baseData,
      peRatio: 10, // Pass (<=15)
      pbRatio: 2.5, // Fail (<=2)
      pegRatio: 0.8, // Pass (<=1)
      evToEbitda: 8, // Pass (<=10)
    };
    
    const result = calculateFCDSTScore(data);
    expect(result.cScore).toBe(3);
    expect(result.cDetails.per).toBe(true);
    expect(result.cDetails.pbv).toBe(false);
  });

  it('handles general sector D score correctly', () => {
    const data: FundamentalData = {
      ...baseData,
      debtToEquity: 0.8, // Pass (<=1)
      currentRatio: 2.0, // Pass (>=1.5)
      interestCoverage: 4.0, // Pass (>=3)
    };
    
    const result = calculateFCDSTScore(data);
    expect(result.dScore.status).toBe('complete');
    expect(result.dScore.score).toBe(3);
    expect(result.dDetails.der).toBe(true);
    expect(result.dDetails.currentRatio).toBe(true);
    expect(result.dDetails.interestCoverage).toBe(true);
  });

  it('evaluates boundary values correctly (exact thresholds should pass)', () => {
    const data: FundamentalData = {
      ...baseData,
      // F Boundaries
      revenueGrowth: 15,
      earningsGrowth: 15,
      roe: 15,
      netProfitMargin: 10,
      grossMargin: 20,
      // C Boundaries
      peRatio: 15,
      pbRatio: 2,
      pegRatio: 1,
      evToEbitda: 10,
      // D Boundaries
      debtToEquity: 1,
      currentRatio: 1.5,
      interestCoverage: 3,
    };
    const result = calculateFCDSTScore(data);
    expect(result.fScore).toBe(5); // all 5 F pass at exact boundary
    expect(result.cScore).toBe(4); // all 4 C pass at exact boundary
    expect(result.dScore.score).toBe(3); // all 3 D pass at exact boundary
  });

  it('supports custom threshold injection', () => {
    const customThresholds: FCDSTThresholds = {
      ...DEFAULT_FCDST_THRESHOLDS,
      perMax: 10, // stricter PER
      roeMin: 20, // stricter ROE
    };
    const data: FundamentalData = {
      ...baseData,
      peRatio: 12, // Would pass default 15, but fails custom 10
      roe: 18,     // Would pass default 15, but fails custom 20
    };
    const result = calculateFCDSTScore(data, null, null, customThresholds);
    expect(result.cDetails.per).toBe(false);
    expect(result.fDetails.roe).toBe(false);
  });

  it('handles null/undefined data for each individual field as false/0', () => {
    const result = calculateFCDSTScore(baseData); // baseData is entirely nulls
    expect(result.fScore).toBe(0);
    expect(result.cScore).toBe(0);
    expect(result.dScore.score).toBe(0);
    
    Object.values(result.fDetails).forEach(val => expect(val).toBe(false));
    Object.values(result.cDetails).forEach(val => expect(val).toBe(false));
    
    // D details can be null when data is null
    expect(result.dDetails.der).toBeNull();
    expect(result.dDetails.currentRatio).toBeNull();
  });

  it('caps F score at 5 but retains bonus pass true', () => {
    const data: FundamentalData = {
      ...baseData,
      revenueGrowth: 20,
      earningsGrowth: 20,
      roe: 20,
      netProfitMargin: 20,
      grossMargin: 30,
      freeCashFlow: 100, // Bonus
    };
    const result = calculateFCDSTScore(data);
    expect(result.fScore).toBe(5);
    expect(result.fDetails.bonusFcfPass).toBe(true); // retains FCF bonus info
  });

  describe('Banking Sector Logic', () => {
    const bankData: FundamentalData = { ...baseData, sector: 'Banks—Regional' };

    it('returns complete score when both NPL and CAR are provided', () => {
      const result = calculateFCDSTScore(bankData, 2.5, 14.0); // NPL <= 3, CAR >= 12
      expect(result.dScore.status).toBe('complete');
      expect(result.dScore.score).toBe(3);
      expect(result.dDetails.npl).toBe(true);
      expect(result.dDetails.car).toBe(true);
    });

    it('returns incomplete when only NPL is provided', () => {
      const result = calculateFCDSTScore(bankData, 2.5, null);
      expect(result.dScore.status).toBe('incomplete');
      expect(result.dScore.score).toBe(0);
    });

    it('returns incomplete when only CAR is provided', () => {
      const result = calculateFCDSTScore(bankData, null, 14.0);
      expect(result.dScore.status).toBe('incomplete');
      expect(result.dScore.score).toBe(0);
    });

    it('returns incomplete when both NPL and CAR are null', () => {
      const result = calculateFCDSTScore(bankData, null, null);
      expect(result.dScore.status).toBe('incomplete');
      expect(result.dScore.score).toBe(0);
    });

    it('returns complete with score 0 when NPL and CAR fail thresholds', () => {
      const result = calculateFCDSTScore(bankData, 5.0, 10.0); // NPL > 3, CAR < 12
      expect(result.dScore.status).toBe('complete');
      expect(result.dScore.score).toBe(0);
      expect(result.dDetails.npl).toBe(false);
      expect(result.dDetails.car).toBe(false);
    });
  });
});
