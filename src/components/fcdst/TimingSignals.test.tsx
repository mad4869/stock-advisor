import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TimingSignals } from './TimingSignals';
import { TechnicalData } from '@/types/fcdst';

const baseScore = {
  priceAboveMA20: true,
  rsiFavorable: true,
  volumeSpike: true,
  mosFavorable: true,
  status: 'BUY ZONE' as const,
};

const baseTechnical: TechnicalData = {
  price: 1000,
  ma20: 900,
  rsi14: 52,
  volume: 2_000_000,
  volume20dAvg: 500_000,
  fairValue: 1500,
  high: 1050,
  low: 950,
};

describe('TimingSignals — Volume Accumulation Proxy', () => {
  it('renders the Accumulation Proxy section', () => {
    render(<TimingSignals technicalData={baseTechnical} tScore={baseScore} />);
    expect(screen.getByText('Accumulation Proxy')).toBeInTheDocument();
  });

  it('shows DETECTED when accumulation criteria met (vol >= 2x, close in upper third)', () => {
    // price=1000, high=1000, low=900 → closingPosition=(1000-900)/100=1.0 >= 0.67
    // volume=2_000_000 / 500_000 = 4x >= 2.0
    const data: TechnicalData = {
      ...baseTechnical,
      price: 1000,
      high: 1000,
      low: 900,
      volume: 2_000_000,
      volume20dAvg: 500_000,
    };
    render(<TimingSignals technicalData={data} tScore={baseScore} />);
    expect(screen.getByText('DETECTED')).toBeInTheDocument();
  });

  it('shows NOT DETECTED when closingPosition < 0.67', () => {
    // price closed near low
    const data: TechnicalData = {
      ...baseTechnical,
      price: 920,
      high: 1050,
      low: 900,
      volume: 2_000_000,
      volume20dAvg: 500_000,
    };
    render(<TimingSignals technicalData={data} tScore={baseScore} />);
    expect(screen.getByText('NOT DETECTED')).toBeInTheDocument();
  });

  it('shows NOT DETECTED when volume ratio < 2', () => {
    const data: TechnicalData = {
      ...baseTechnical,
      price: 1000,
      high: 1000,
      low: 900,
      volume: 800_000, // 1.6x
      volume20dAvg: 500_000,
    };
    render(<TimingSignals technicalData={data} tScore={baseScore} />);
    expect(screen.getByText('NOT DETECTED')).toBeInTheDocument();
  });

  it('renders the disclaimer about heuristic estimate', () => {
    render(<TimingSignals technicalData={baseTechnical} tScore={baseScore} />);
    expect(
      screen.getByText(/Volume Accumulation Proxy is a heuristic estimate/i)
    ).toBeInTheDocument();
  });

  it('renders without crashing when no technicalData', () => {
    render(<TimingSignals />);
    expect(screen.getByText(/Technical data unavailable/i)).toBeInTheDocument();
  });
});
