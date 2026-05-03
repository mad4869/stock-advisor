import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FCDSTScoreCard } from './FCDSTScoreCard';
import { FCDSTScore } from '@/types/fcdst';

describe('FCDSTScoreCard', () => {
  afterEach(() => {
    cleanup();
  });

  const baseScore: FCDSTScore = {
    fScore: 0,
    fDetails: {
      revenueGrowth: false,
      netIncomeGrowth: false,
      roe: false,
      netProfitMargin: false,
      grossProfitMargin: false,
      bonusFcfPass: false,
    },
    cScore: 0,
    cDetails: { per: false, pbv: false, peg: false, evEbitda: false },
    dScore: { status: 'complete', score: 0 },
    dDetails: { der: false, currentRatio: false, interestCoverage: false, npl: null, car: null },
    sScore: 0,
    sDetails: { megatrend: false, moat: false, catalyst: false },
    totalScore: 0,
    grade: 'D',
  };

  it('renders Grade A+ (score 13-15) correctly', () => {
    const score: FCDSTScore = {
      ...baseScore,
      fScore: 5,
      cScore: 4,
      dScore: { status: 'complete', score: 3 },
      sScore: 3,
      totalScore: 15,
      grade: 'A+',
    };
    render(<FCDSTScoreCard score={score} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText('A+').length).toBeGreaterThan(0);
    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('renders Grade B (score 10-12) correctly', () => {
    const score: FCDSTScore = {
      ...baseScore,
      fScore: 4,
      cScore: 3,
      dScore: { status: 'complete', score: 2 },
      sScore: 2,
      totalScore: 11,
      grade: 'B',
    };
    render(<FCDSTScoreCard score={score} />);
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getAllByText('B').length).toBeGreaterThan(0);
  });

  it('renders Grade C (score 7-9) correctly', () => {
    const score: FCDSTScore = {
      ...baseScore,
      fScore: 3,
      cScore: 2,
      dScore: { status: 'complete', score: 2 },
      sScore: 1,
      totalScore: 8,
      grade: 'C',
    };
    render(<FCDSTScoreCard score={score} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getAllByText('C').length).toBeGreaterThan(0);
  });

  it('renders Grade D (score <7) correctly', () => {
    const score: FCDSTScore = {
      ...baseScore,
      fScore: 1,
      cScore: 1,
      dScore: { status: 'complete', score: 1 },
      sScore: 0,
      totalScore: 3,
      grade: 'D',
    };
    render(<FCDSTScoreCard score={score} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('D').length).toBeGreaterThan(0);
  });

  it('renders incomplete state correctly for banking', () => {
    const score: FCDSTScore = {
      ...baseScore,
      dScore: { status: 'incomplete', score: 0 },
      totalScore: 'Incomplete',
      grade: 'Incomplete',
    };
    const handleManualClick = vi.fn();
    render(<FCDSTScoreCard score={score} onManualInputClick={handleManualClick} />);
    
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getAllByText('Inc.').length).toBeGreaterThan(0);
    expect(screen.getByText(/Bank sector requires manual NPL\/CAR inputs/i)).toBeInTheDocument();
    
    const manualBtn = screen.getByRole('button', { name: /Input NPL\/CAR/i });
    fireEvent.click(manualBtn);
    expect(handleManualClick).toHaveBeenCalledTimes(1);
  });

  it('shows FCF bonus indicator when true and hides when false', () => {
    const { rerender } = render(<FCDSTScoreCard score={{ ...baseScore, fDetails: { ...baseScore.fDetails, bonusFcfPass: true } }} />);
    expect(screen.getByText(/FCF Bonus/i)).toBeInTheDocument();

    rerender(<FCDSTScoreCard score={{ ...baseScore, fDetails: { ...baseScore.fDetails, bonusFcfPass: false } }} />);
    expect(screen.queryByText(/FCF Bonus/i)).not.toBeInTheDocument();
  });

  it('renders Pending Story state correctly', () => {
    const score: FCDSTScore = {
      ...baseScore,
      fScore: 5,
      cScore: 4,
      dScore: { status: 'complete', score: 3 },
      sScore: 'Pending',
      totalScore: 12,
      grade: 'B (Pending Story)',
    };
    render(<FCDSTScoreCard score={score} />);
    
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('B').length).toBeGreaterThan(0);
    expect(screen.getByText(/Pending Story Analysis/i)).toBeInTheDocument();
    expect(screen.getByText('Pend.')).toBeInTheDocument();
  });

  it('renders Timing (T) section when provided', () => {
    const score: FCDSTScore = {
      ...baseScore,
      tScore: {
        priceAboveMA20: true,
        rsiFavorable: false,
        volumeSpike: true,
        mosFavorable: true,
        status: 'BUY ZONE',
      }
    };
    render(<FCDSTScoreCard score={score} />);
    expect(screen.getByText('Timing (Action)')).toBeInTheDocument();
    expect(screen.getByText('BUY ZONE')).toBeInTheDocument();
    expect(screen.getByText('Price > MA20')).toBeInTheDocument();
  });
});
