import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordSellForm, getFCDSTScoreDiff } from './RecordSellForm';
import { buildClosedPositionFromWatchlistItem } from '@/components/WatchlistTable';
import { WatchlistItem } from '@/types';

const mockItem: WatchlistItem = {
  id: 'watch-1',
  symbol: 'AAPL',
  market: 'US',
  name: 'Apple Inc.',
  buyPrice: 100,
  buyDate: '2026-01-01',
  quantity: 10,
  currentPrice: 125,
  pnl: 250,
  pnlPercent: 25,
  action: 'HOLD',
  actionReason: 'Monitoring',
  lastUpdated: '2026-05-03T00:00:00.000Z',
  fcdstScore: {
    totalScore: 14,
    grade: 'A',
    fScore: 5,
    cScore: 4,
    dScore: { status: 'complete', score: 3 },
    sScore: 2,
    snapshotDate: 1767225600000,
  },
  thesis: {
    summary: 'Strong thesis recorded at buy time.',
  },
};

const formatCurrency = (value: number) => `$${value}`;

describe('RecordSellForm (Commit 8)', () => {
  it('score diff computed from mock buy score vs current score', () => {
    expect(getFCDSTScoreDiff(mockItem.fcdstScore, { totalScore: 10, grade: 'B' })).toBe(-4);

    render(
      <RecordSellForm
        item={mockItem}
        currentFcdstScore={{ totalScore: 10, grade: 'B' }}
        formatCurrency={formatCurrency as any}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('14/15 [A]')).toBeInTheDocument();
    expect(screen.getByText('10/15 [B]')).toBeInTheDocument();
    expect(screen.getByText('-4')).toBeInTheDocument();
  });

  it('lesson < 20 chars -> validation error', async () => {
    const onSubmit = vi.fn();
    render(
      <RecordSellForm
        item={mockItem}
        currentFcdstScore={{ totalScore: 10, grade: 'B' }}
        formatCurrency={formatCurrency as any}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('I learned that...'), { target: { value: 'Too short' } });
    fireEvent.change(screen.getByPlaceholderText(/Current:/), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText(/Correct/));
    fireEvent.click(screen.getByText('Sell & Save'));

    expect(await screen.findByText(/Lesson learned must be at least 20 characters/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lesson whitespace only -> rejected', async () => {
    const onSubmit = vi.fn();
    render(
      <RecordSellForm
        item={mockItem}
        currentFcdstScore={{ totalScore: 10, grade: 'B' }}
        formatCurrency={formatCurrency as any}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('I learned that...'), { target: { value: '                         ' } });
    fireEvent.change(screen.getByPlaceholderText(/Current:/), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText(/Correct/));
    fireEvent.click(screen.getByText('Sell & Save'));

    expect(await screen.findByText(/Lesson learned must be at least 20 characters/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('thesis accuracy radio required', async () => {
    const onSubmit = vi.fn();
    render(
      <RecordSellForm
        item={mockItem}
        currentFcdstScore={{ totalScore: 10, grade: 'B' }}
        formatCurrency={formatCurrency as any}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('I learned that...'), {
      target: { value: 'This trade taught me to respect thesis decay.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Current:/), { target: { value: '120' } });
    fireEvent.click(screen.getByText('Sell & Save'));

    expect(await screen.findByText(/Please select if your thesis was correct/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('successful save persists to closed positions shape', async () => {
    const onSubmit = vi.fn();
    render(
      <RecordSellForm
        item={mockItem}
        currentFcdstScore={{ totalScore: 10, grade: 'B' }}
        formatCurrency={formatCurrency as any}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('I learned that...'), {
      target: { value: 'This trade taught me to sell when the score deteriorates.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Current:/), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText(/Partially correct/));
    fireEvent.click(screen.getByText('Sell & Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        120,
        'This trade taught me to sell when the score deteriorates.',
        'partially_correct',
        { totalScore: 10, grade: 'B' }
      );
    });

    const closed = buildClosedPositionFromWatchlistItem({
      item: mockItem,
      sellPrice: 120,
      lessonLearned: 'This trade taught me to sell when the score deteriorates.',
      thesisAccuracy: 'partially_correct',
      scoreAtSell: { totalScore: 10, grade: 'B' },
    });

    expect(closed).toEqual(expect.objectContaining({
      symbol: 'AAPL',
      sellPrice: 120,
      pnl: 200,
      pnlPercent: 20,
      lessonLearned: 'This trade taught me to sell when the score deteriorates.',
      thesisAccuracy: 'partially_correct',
      fcdstScoreAtBuy: mockItem.fcdstScore,
      fcdstScoreAtSell: expect.objectContaining({ totalScore: 10, grade: 'B' }),
    }));
  });
});
