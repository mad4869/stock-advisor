import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFCDSTAnalysis } from './useFCDSTAnalysis';
import { FundamentalData } from '@/types/screener';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';
import { useFCDSTThresholdsStore } from '@/lib/fcdstThresholdsStore';
import { DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';

const mockFundamentalData: FundamentalData = {
  symbol: 'DEMO',
  name: 'Demo Corp',
  market: { id: 'idx', name: 'IDX', country: 'ID', currency: 'IDR', timezone: 'Asia/Jakarta' },
  currency: 'IDR',
  sector: 'Consumer',
  revenueGrowth: 20,
  earningsGrowth: 20,
  roe: 20,
  netProfitMargin: 15,
  grossMargin: 30,
  freeCashFlow: 1000,
  peRatio: 10,
  pbRatio: 1.5,
  pegRatio: 0.8,
  evToEbitda: 8,
  debtToEquity: 0.5,
  currentRatio: 2.0,
  interestCoverage: 5,
  forwardPE: null,
  psRatio: null,
  roa: null,
  operatingMargin: null,
  epsGrowthCurrentYear: null,
  epsGrowthNext5Y: null,
  dividendYield: null,
  payoutRatio: null,
  marketCap: null,
  avgVolume3M: null,
  high52Week: null,
  low52Week: null,
  beta: null,
  price: 1000,
};

describe('useFCDSTAnalysis — threshold store integration', () => {
  beforeEach(() => {
    useBankingMetricsStore.setState({ metrics: {} });
    useStoryAnalysisStore.setState({ analyses: {} });
    useFCDSTThresholdsStore.setState({ thresholds: { ...DEFAULT_FCDST_THRESHOLDS } });
  });

  it('returns correct scores for mock data (default thresholds)', () => {
    const { result } = renderHook(() =>
      useFCDSTAnalysis({ symbol: 'DEMO', fundamentalData: mockFundamentalData })
    );
    expect(result.current.fScore).toBe(5);
    expect(result.current.cScore).toBe(4);
    expect(result.current.dScore.score).toBe(3);
    expect(result.current.sScore).toBe('Pending');
    expect(result.current.totalScore).toBe(12);
    expect(result.current.grade).toBe('B (Pending Story)');
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isBanking).toBe(false);
  });

  it('handles banking sector by setting dScore incomplete initially', () => {
    const { result } = renderHook(() =>
      useFCDSTAnalysis({
        symbol: 'BBCA',
        fundamentalData: { ...mockFundamentalData, symbol: 'BBCA', sector: 'Banks' },
      })
    );
    expect(result.current.isBanking).toBe(true);
    expect(result.current.dScore.status).toBe('incomplete');
    expect(result.current.totalScore).toBe('Incomplete');
  });

  it('recomputes when store updates (story save)', () => {
    const { result } = renderHook(() =>
      useFCDSTAnalysis({ symbol: 'DEMO', fundamentalData: mockFundamentalData })
    );
    expect(result.current.sScore).toBe('Pending');
    act(() => {
      useStoryAnalysisStore.getState().saveAnalysis('DEMO', {
        megatrend: { checked: true, justification: 'yes' },
        moat: { checked: true, justification: 'yes' },
        catalyst: { checked: true, justification: 'yes' },
      });
      result.current.handleChildSave();
    });
    expect(result.current.sScore).toBe(3);
    expect(result.current.totalScore).toBe(15);
    expect(result.current.grade).toBe('A+');
    expect(result.current.isComplete).toBe(true);
  });

  it('score recomputes when ROE threshold changes via store', () => {
    const { result } = renderHook(() =>
      useFCDSTAnalysis({ symbol: 'DEMO', fundamentalData: mockFundamentalData })
    );
    // Default: ROE=20 passes roeMin=15, netIncome=20 passes netIncomeGrowthMin=15
    // fRaw = revGrowth✓ + netInc✓ + ROE✓ + npm✓ + gpm✓ = 5 + FCF bonus = 6 → capped at 5
    expect(result.current.fScore).toBe(5);

    // Raise BOTH roeMin and netIncomeGrowthMin above data values (20)
    // → ROE=20 < roeMin=25 → FAIL; netInc=20 < netIncomeGrowthMin=25 → FAIL
    // fRaw = revGrowth✓ + netInc✗ + ROE✗ + npm✓ + gpm✓ = 3 + FCF bonus = 4 → fScore=4
    act(() => {
      useFCDSTThresholdsStore.getState().setThresholds({ roeMin: 25, netIncomeGrowthMin: 25 });
    });
    expect(result.current.fDetails.roe).toBe(false);
    expect(result.current.fDetails.netIncomeGrowth).toBe(false);
    expect(result.current.fScore).toBe(4);
  });

  it('screener results recompute — changing PER threshold filters previously passing stock', () => {
    const { result } = renderHook(() =>
      useFCDSTAnalysis({ symbol: 'DEMO', fundamentalData: mockFundamentalData })
    );
    // peRatio=10 passes default perMax=15
    expect(result.current.cDetails.per).toBe(true);

    act(() => {
      useFCDSTThresholdsStore.getState().setThresholds({ perMax: 8 });
    });
    // peRatio=10 > perMax=8 → fails now
    expect(result.current.cDetails.per).toBe(false);
    expect(result.current.cScore).toBe(3);
  });
});
