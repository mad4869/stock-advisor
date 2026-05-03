import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FCDSTFlatView } from './FCDSTFlatView';
import { FundamentalData } from '@/types/screener';
import { TechnicalData } from '@/types/fcdst';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

const mockTechnicalData: TechnicalData = {
  price: 1000,
  ma20: 900,
  rsi14: 50,
  volume: 1000000,
  volume20dAvg: 800000,
  fairValue: 1500,
};

describe('FCDSTFlatView', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useBankingMetricsStore.setState({ metrics: {} });
    useStoryAnalysisStore.setState({ analyses: {} });
  });

  const renderComponent = (data = mockFundamentalData, techData = mockTechnicalData) => {
    return render(
      <FCDSTFlatView 
        symbol={data.symbol} 
        fundamentalData={data} 
        technicalData={techData} 
      />
    );
  };

  it('renders all 5 sections vertically', () => {
    renderComponent();
    
    expect(screen.getByText('[F] Fundamental (Quality)')).toBeInTheDocument();
    expect(screen.getByText('[C] Cheap (Valuation)')).toBeInTheDocument();
    expect(screen.getByText('[D] Debt (Health)')).toBeInTheDocument();
    expect(screen.getByText('[S] Story (Moat)')).toBeInTheDocument();
    // Use a custom matcher to find the element that contains "[T] Timing (Action)"
    expect(screen.getByText(/\[T\] Timing \(Action\)/i)).toBeInTheDocument();
  });

  it('renders sticky header with score', () => {
    renderComponent();
    
    const header = screen.getByText(/FCDS-T Analysis:/i).closest('div');
    expect(within(header!).getByText('12/15')).toBeInTheDocument();
    expect(within(header!).getByText('B')).toBeInTheDocument();
    expect(within(header!).getByText('S Pending')).toBeInTheDocument();
  });

  it('Step T is locked when S is incomplete', () => {
    renderComponent();
    
    expect(screen.getByText(/Complete Story analysis above to unlock Timing signals/i)).toBeInTheDocument();
  });

  it('Step T displays signals when S is complete', () => {
    useStoryAnalysisStore.setState({
      analyses: {
        'DEMO': {
          megatrend: { checked: true, justification: 'yes' },
          moat: { checked: false, justification: '' },
          catalyst: { checked: false, justification: '' },
          lastUpdated: Date.now()
        }
      }
    });
    
    renderComponent();
    expect(screen.queryByText(/Complete Story analysis above/i)).not.toBeInTheDocument();
    expect(screen.getByText(/BUY ZONE/i)).toBeInTheDocument();
  });
});
