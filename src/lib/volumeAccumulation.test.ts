import { describe, it, expect } from 'vitest';
import { calculateVolumeAccumulation } from './fcdstEngine';
import { TechnicalData } from '@/types/fcdst';

const baseTechnical: TechnicalData = {
  price: 1000,
  ma20: 950,
  rsi14: 50,
  volume: 1_000_000,
  volume20dAvg: 500_000,
  high: 1050,
  low: 950,
};

describe('calculateVolumeAccumulation', () => {
  it('detects accumulation when volumeRatio >= 2.0 and closingPosition >= 0.67', () => {
    // price=1000, low=950, high=1050 → range=100, closingPosition=(1000-950)/100=0.5? No, need to adjust
    // Let's design: low=900, high=1000 → price=1000 → closingPosition=(1000-900)/100=1.0
    // volume=2_000_000 / 500_000 = 4x
    const data: TechnicalData = {
      ...baseTechnical,
      price: 1000,
      high: 1000,
      low: 900,
      volume: 2_000_000, // 4x avg
      volume20dAvg: 500_000,
    };
    const result = calculateVolumeAccumulation(data);
    expect(result.isAccumulating).toBe(true);
    expect(result.volumeRatio).toBeCloseTo(4.0);
    expect(result.closingPosition).toBeCloseTo(1.0);
  });

  it('returns NOT accumulating when volumeRatio < 2.0', () => {
    const data: TechnicalData = {
      ...baseTechnical,
      volume: 800_000, // 1.6x avg — below threshold
      volume20dAvg: 500_000,
      high: 1000,
      low: 900,
      price: 990,
    };
    const result = calculateVolumeAccumulation(data);
    expect(result.volumeRatio).toBeCloseTo(1.6);
    expect(result.isAccumulating).toBe(false);
  });

  it('returns NOT accumulating when closingPosition < 0.67 even with high volume', () => {
    // Price closed near the LOW — selling pressure despite high volume
    const data: TechnicalData = {
      ...baseTechnical,
      price: 920, // closed near low
      high: 1050,
      low: 900,
      volume: 2_000_000, // 4x avg
      volume20dAvg: 500_000,
    };
    const result = calculateVolumeAccumulation(data);
    // closingPosition = (920-900)/150 ≈ 0.133 < 0.67
    expect(result.closingPosition).toBeLessThan(0.67);
    expect(result.isAccumulating).toBe(false);
    expect(result.confidence).toBe('low');
  });

  it('assigns high confidence when volumeRatio >= 3.0 and closingPosition >= 0.8', () => {
    const data: TechnicalData = {
      ...baseTechnical,
      price: 1040,
      high: 1050,
      low: 900,
      volume: 2_000_000, // 4x avg
      volume20dAvg: 500_000,
    };
    // closingPosition = (1040-900)/150 = 0.933 >= 0.8
    const result = calculateVolumeAccumulation(data);
    expect(result.confidence).toBe('high');
  });

  it('assigns medium confidence when isAccumulating but NOT high confidence criteria', () => {
    // volumeRatio=2.5 (< 3), closingPosition=0.75 (>= 0.67, < 0.8)
    const data: TechnicalData = {
      ...baseTechnical,
      price: 975,
      high: 1000,
      low: 900,
      volume: 1_250_000, // 2.5x avg
      volume20dAvg: 500_000,
    };
    // closingPosition = (975-900)/100 = 0.75
    const result = calculateVolumeAccumulation(data);
    expect(result.isAccumulating).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('handles edge case: high === low (no intraday range) → closingPosition = 0', () => {
    const data: TechnicalData = {
      ...baseTechnical,
      price: 1000,
      high: 1000,
      low: 1000,
      volume: 3_000_000,
      volume20dAvg: 500_000,
    };
    const result = calculateVolumeAccumulation(data);
    expect(result.closingPosition).toBe(0);
    expect(result.isAccumulating).toBe(false); // closingPosition < 0.67
  });

  it('handles missing high/low (uses price for both) → closingPosition = 0', () => {
    const data: TechnicalData = {
      // Deliberately omit high and low (spread base but clear them)
      price: 1000,
      ma20: 950,
      rsi14: 50,
      volume: 3_000_000,
      volume20dAvg: 500_000,
      // high and low are intentionally NOT provided
    };
    // high = price = 1000, low = price = 1000 → range = 0 → closingPosition = 0
    const result = calculateVolumeAccumulation(data);
    expect(result.closingPosition).toBe(0);
  });

  it('volumeRatio is 0 when avg volume is 0 (avoid division by zero)', () => {
    const data: TechnicalData = {
      ...baseTechnical,
      volume: 1_000_000,
      volume20dAvg: 0,
    };
    const result = calculateVolumeAccumulation(data);
    expect(result.volumeRatio).toBe(0);
    expect(result.isAccumulating).toBe(false);
  });
});
