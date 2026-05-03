import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordBuyForm } from './RecordBuyForm';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';

// Mock Zustand stores
vi.mock('@/lib/watchlistStore', () => ({
  useWatchlistStore: vi.fn(),
}));

vi.mock('@/lib/storyAnalysisStore', () => ({
  useStoryAnalysisStore: vi.fn(),
}));

describe('RecordBuyForm (Commit 8)', () => {
  const mockAddItem = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useWatchlistStore as any).mockImplementation((selector: any) => selector({
      addItem: mockAddItem,
    }));
    
    (useStoryAnalysisStore as any).mockImplementation((selector: any) => selector({
      analyses: {
        'BBCA.JK': {
          symbol: 'BBCA.JK',
          megatrend: { checked: true, justification: 'Mock megatrend justification text' },
          moat: { checked: true, justification: 'Mock moat justification text' },
          catalyst: { checked: true, justification: 'Mock catalyst justification text' },
          lastUpdated: Date.now(),
        },
      },
    }));
  });

  const defaultProps = {
    symbol: 'BBCA.JK',
    market: 'ID' as const,
    currentPrice: 10000,
    stockName: 'Bank Central Asia',
    fcdstScoreSnapshot: { totalScore: 14, grade: 'A', fScore: 5, cScore: 3, dScore: { passed: true }, sScore: 3 },
    onCancel: mockOnCancel,
    onSuccess: mockOnSuccess,
  };

  it('renders with pre-filled story data', () => {
    render(<RecordBuyForm {...defaultProps} />);
    
    expect(screen.getByDisplayValue('Mock megatrend justification text')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mock moat justification text')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mock catalyst justification text')).toBeInTheDocument();
    expect(screen.getByText(/14\/15/)).toBeInTheDocument();
  });

  it('summary < 20 chars -> validation error', async () => {
    render(<RecordBuyForm {...defaultProps} />);
    
    fireEvent.change(screen.getByPlaceholderText(/I'm buying this because.../), { target: { value: 'Too short' } });
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '10' } });
    fireEvent.click(screen.getByText(/Save & Record Transaction/));
    
    expect(await screen.findByText(/Investment thesis summary must be at least 20 characters/)).toBeInTheDocument();
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('summary with whitespace only -> rejected', async () => {
    render(<RecordBuyForm {...defaultProps} />);
    
    fireEvent.change(screen.getByPlaceholderText(/I'm buying this because.../), { target: { value: '                      ' } });
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '10' } });
    fireEvent.click(screen.getByText(/Save & Record Transaction/));
    
    expect(await screen.findByText(/Investment thesis summary must be at least 20 characters/)).toBeInTheDocument();
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('successful save persists to watchlist store with FCDS-T score auto-captured and optional fields empty', async () => {
    render(<RecordBuyForm {...defaultProps} />);
    
    const validSummary = 'This is a valid summary that is longer than twenty characters.';
    fireEvent.change(screen.getByPlaceholderText(/I'm buying this because.../), { target: { value: validSummary } });
    fireEvent.change(screen.getByLabelText(/Quantity/), { target: { value: '10' } });
    
    // Leaving optional fields (Fair Value, Target Return) empty
    
    fireEvent.click(screen.getByText(/Save & Record Transaction/));
    
    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BBCA.JK',
        buyPrice: 10000,
        fcdstScore: expect.objectContaining({ totalScore: 14 }),
        thesis: expect.objectContaining({
          summary: validSummary,
          megatrendNote: 'Mock megatrend justification text',
          fairValue: undefined,
          targetReturn: undefined,
          holdPeriod: undefined
        })
      }));
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
