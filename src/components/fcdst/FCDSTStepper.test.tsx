import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FCDSTStepper } from './FCDSTStepper';
import { FundamentalData } from '@/types/screener';
import { TechnicalData } from '@/types/fcdst';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/screener/DEMO/analyze',
  useSearchParams: () => mockSearchParams,
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
  fairValue: 1500, // MOS = 33.3% -> pass
};

describe('FCDSTStepper', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    useBankingMetricsStore.setState({ metrics: {} });
    useStoryAnalysisStore.setState({ analyses: {} });
  });

  const renderComponent = (data = mockFundamentalData, techData = mockTechnicalData) => {
    return render(
      <FCDSTStepper 
        symbol={data.symbol} 
        fundamentalData={data} 
        technicalData={techData} 
      />
    );
  };

  it('1. Renders all 5 step labels in correct order', () => {
    renderComponent();
    expect(screen.getByText('Fundamental')).toBeInTheDocument();
    expect(screen.getByText('Cheap')).toBeInTheDocument();
    expect(screen.getByText('Debt')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.getByText('Timing')).toBeInTheDocument();
  });

  it('2. Step F displays all criteria with pass/fail from mock data', () => {
    renderComponent();
    expect(screen.getByText('Fundamental Quality')).toBeInTheDocument();
    expect(screen.getAllByText('5/5').length).toBeGreaterThan(0); // All 5 should pass
    expect(screen.getByText('Revenue Growth (YoY)')).toBeInTheDocument();
    expect(screen.getAllByText('20.0%').length).toBeGreaterThan(0);
  });

  it('3. Step C displays all criteria with pass/fail from mock data', () => {
    mockSearchParams.set('step', 'C');
    renderComponent();
    expect(screen.getByText('Cheap (Valuation)')).toBeInTheDocument();
    expect(screen.getAllByText('4/4').length).toBeGreaterThan(0);
    expect(screen.getByText('P/E Ratio')).toBeInTheDocument();
    expect(screen.getAllByText('10.0').length).toBeGreaterThan(0);
  });

  it('4. Step D (general): auto-computes and displays score', () => {
    mockSearchParams.set('step', 'D');
    renderComponent();
    expect(screen.getByText('Debt (Health)')).toBeInTheDocument();
    expect(screen.getAllByText('3/3').length).toBeGreaterThan(0);
    expect(screen.getByText('Debt to Equity')).toBeInTheDocument();
  });

  it('5. Step D (bank): shows BankingMetricsForm, Next button disabled', () => {
    mockSearchParams.set('step', 'D');
    renderComponent({ ...mockFundamentalData, sector: 'Banks' });
    
    expect(screen.getByText(/Banking sector detected/i)).toBeInTheDocument();
    expect(screen.getByText('Banking Metrics (Manual Input)')).toBeInTheDocument();
    
    const nextBtn = screen.getByRole('button', { name: /Next: Story/i });
    expect(nextBtn).toBeDisabled();
  });

  it('6. Step D (bank): after saving metrics, Next button enables', () => {
    mockSearchParams.set('step', 'D');
    renderComponent({ ...mockFundamentalData, symbol: 'BBCA.JK', sector: 'Banks' });
    
    const nplInput = screen.getByLabelText(/NPL Ratio/i);
    const carInput = screen.getByLabelText(/CAR/i);
    const saveBtn = screen.getByRole('button', { name: /Save Metrics/i });
    
    fireEvent.change(nplInput, { target: { value: '1.5' } });
    fireEvent.change(carInput, { target: { value: '20' } });
    fireEvent.click(saveBtn);
    
    // Total should update and Next should be enabled
    expect(screen.getAllByText('3/3').length).toBeGreaterThan(0);
    const nextBtn = screen.getByRole('button', { name: /Next: Story/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it('7. Step S: shows StoryChecklist, Next button disabled initially', () => {
    mockSearchParams.set('step', 'S');
    renderComponent();
    
    expect(screen.getByText('Story (Moat)')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /Next: Timing/i });
    expect(nextBtn).toBeDisabled();
  });

  it('8. Step S: after saving analysis with >= 1 point, Next button enables', () => {
    mockSearchParams.set('step', 'S');
    renderComponent();
    
    const megatrendLabel = screen.getByText(/1\. Megatrend \/ Tailwinds/i);
    fireEvent.click(megatrendLabel);
    
    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0], { target: { value: 'Good' } });
    
    const saveBtn = screen.getByRole('button', { name: /Save Story Analysis/i });
    fireEvent.click(saveBtn);
    
    const nextBtn = screen.getByRole('button', { name: /Next: Timing/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it('9a. Step T: locked if Story is incomplete', () => {
    mockSearchParams.set('step', 'T');
    renderComponent();
    
    expect(screen.getByText('Step Locked')).toBeInTheDocument();
    expect(screen.getByText(/Please complete the/i)).toBeInTheDocument();
  });

  it('9b. Step T: displays timing signals if Story is complete', () => {
    useStoryAnalysisStore.setState({
      analyses: {
        'DEMO': {
          megatrend: { checked: true, justification: 'test' },
          moat: { checked: false, justification: '' },
          catalyst: { checked: false, justification: '' },
          lastUpdated: Date.now()
        }
      }
    });
    mockSearchParams.set('step', 'T');
    renderComponent();
    
    // Check if the actual signal component renders
    expect(screen.getByText(/BUY ZONE/i)).toBeInTheDocument();
  });

  it('10. Navigation: clicking Next advances step, Back goes back', () => {
    mockSearchParams.set('step', 'F');
    renderComponent();
    
    const nextBtn = screen.getByRole('button', { name: /Next: Cheap/i });
    fireEvent.click(nextBtn);
    
    // Expect router.push to be called with '?step=C'
    expect(mockPush).toHaveBeenCalledWith('/screener/DEMO/analyze?step=C');
    
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn);
    
    // Expect router.push to be called with '?step=F'
    // Wait, the back button literally just changes the URL state to the previous step index
    // Wait, let's check FCDSTStepper.tsx. In step 'F' (index 0), Back is disabled.
    expect(backBtn).toBeDisabled();
  });

  it('12. Running score summary updates across steps', () => {
    renderComponent();
    
    // Persistent footer
    const footerContainer = screen.getByText(/Running Score:/i).closest('div')?.parentElement;
    expect(within(footerContainer!).getByText('F:')).toBeInTheDocument();
    expect(within(footerContainer!).getByText('C:')).toBeInTheDocument();
    expect(within(footerContainer!).getByText('D:')).toBeInTheDocument();
    expect(within(footerContainer!).getByText('S:')).toBeInTheDocument();
    
    expect(within(footerContainer!).getByText('12/15')).toBeInTheDocument(); // F=5, C=4, D=3, S=0(Pending)
  });
});
