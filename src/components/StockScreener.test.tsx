import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StockScreener from './StockScreener';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver
});

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockScreenerResult = [
  {
    stock: {
      symbol: 'GOOD',
      name: 'Good Stock',
      market: 'US',
      sector: 'Technology',
      revenueGrowth: 20,
      earningsGrowth: 20,
      roe: 20,
      netProfitMargin: 15,
      grossMargin: 30,
      peRatio: 10,
      pbRatio: 1.5,
      pegRatio: 0.8,
      evToEbitda: 8,
      debtToEquity: 0.5,
      currentRatio: 2.0,
      interestCoverage: 5,
    }
  },
  {
    stock: {
      symbol: 'BAD',
      name: 'Bad Stock',
      market: 'US',
      sector: 'Technology',
      revenueGrowth: 5,
      earningsGrowth: 5,
      roe: 5,
      netProfitMargin: 5,
      grossMargin: 10,
      peRatio: 30,
      pbRatio: 5,
      pegRatio: 2,
      evToEbitda: 20,
      debtToEquity: 2.0,
      currentRatio: 0.5,
      interestCoverage: 1,
    }
  }
];

describe('StockScreener FCDS-T Filters', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useBankingMetricsStore.setState({ metrics: {} });
    useStoryAnalysisStore.setState({ analyses: {} });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: mockScreenerResult,
        totalScreened: 2,
        totalMatched: 2,
        errors: []
      })
    });
  });

  const runScreener = async () => {
    render(<StockScreener />);
    const runBtn = screen.getByRole('button', { name: /Run Screener/i });
    await act(async () => {
      fireEvent.click(runBtn);
    });
  };

  it('renders screener results and shows FCDS-T filter UI', async () => {
    await runScreener();
    expect(screen.getByText('GOOD')).toBeInTheDocument();
    expect(screen.getByText('BAD')).toBeInTheDocument();
    expect(screen.getByText('FCDS-T Analysis Filters')).toBeInTheDocument();
  });

  it('filters by Min Score', async () => {
    await runScreener();
    
    // Set S Score to ensure completion for 'GOOD' stock
    act(() => {
      useStoryAnalysisStore.getState().saveAnalysis('GOOD', {
        megatrend: { checked: true, justification: 'yes' },
        moat: { checked: true, justification: 'yes' },
        catalyst: { checked: true, justification: 'yes' },
      });
    });

    const minScoreInput = screen.getByPlaceholderText('e.g. 10');
    
    await act(async () => {
      fireEvent.change(minScoreInput, { target: { value: '10' } });
    });

    // GOOD stock should be 15/15 (A+)
    // BAD stock should be 0/15 (D), and its score is incomplete unless we also add story for BAD, but since we didn't, totalScore for BAD is 'Incomplete'
    
    expect(screen.getByText('GOOD')).toBeInTheDocument();
    expect(screen.queryByText('BAD')).not.toBeInTheDocument();
  });

  it('filters by Grade', async () => {
    await runScreener();
    
    // Make GOOD an A+ by saving story
    act(() => {
      useStoryAnalysisStore.getState().saveAnalysis('GOOD', {
        megatrend: { checked: true, justification: 'yes' },
        moat: { checked: true, justification: 'yes' },
        catalyst: { checked: true, justification: 'yes' },
      });
    });

    const gradeABtn = screen.getByRole('button', { name: 'A+' });
    
    await act(async () => {
      fireEvent.click(gradeABtn);
    });

    expect(screen.getByText('GOOD')).toBeInTheDocument();
    expect(screen.queryByText('BAD')).not.toBeInTheDocument();
  });

  it('filters by Hide Incomplete', async () => {
    await runScreener();
    
    // Complete GOOD, leave BAD incomplete
    act(() => {
      useStoryAnalysisStore.getState().saveAnalysis('GOOD', {
        megatrend: { checked: true, justification: 'yes' },
        moat: { checked: true, justification: 'yes' },
        catalyst: { checked: true, justification: 'yes' },
      });
    });

    const hideIncompleteCb = screen.getByLabelText(/Hide Incomplete/i);
    
    await act(async () => {
      fireEvent.click(hideIncompleteCb);
    });

    expect(screen.getByText('GOOD')).toBeInTheDocument();
    expect(screen.queryByText('BAD')).not.toBeInTheDocument();
  });
});
