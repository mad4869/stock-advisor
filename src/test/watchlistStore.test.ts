import { describe, it, expect, beforeEach } from 'vitest';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { usePortfolioStore } from '@/lib/portfolioStore';
import { buildClosedPositionFromWatchlistItem } from '@/components/WatchlistTable';
import { WatchlistItem } from '@/types';

// ============================================================
// Helpers
// ============================================================

function makeItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: 'test-1',
    symbol: 'AAPL',
    market: 'US',
    name: 'Apple Inc.',
    buyPrice: 150,
    stopLossPrice: null,
    takeProfitPrice: null,
    buyDate: '2025-01-01',
    quantity: 10,
    currentPrice: 160,
    pnl: 100,
    pnlPercent: 6.67,
    action: 'HOLD',
    actionReason: 'Test',
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function makeIDItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return makeItem({
    symbol: 'BBCA',
    market: 'ID',
    name: 'Bank Central Asia Tbk',
    buyPrice: 9000,
    currentPrice: 9500,
    quantity: 5, // 5 lots = 500 shares
    ...overrides,
  });
}

// ============================================================
// Watchlist Store — CRUD
// ============================================================

describe('Watchlist Store', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ items: [] });
  });

  describe('addItem', () => {
    it('adds an item with auto-generated fields', () => {
      useWatchlistStore.getState().addItem({
        symbol: 'AAPL',
        market: 'US',
        name: 'Apple Inc.',
        buyPrice: 150,
        stopLossPrice: null,
        takeProfitPrice: null,
        buyDate: '2025-01-01',
        quantity: 10,
      });

      const items = useWatchlistStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].symbol).toBe('AAPL');
      expect(items[0].buyPrice).toBe(150);
      expect(items[0].quantity).toBe(10);
      expect(items[0].currentPrice).toBe(150); // defaults to buyPrice
      expect(items[0].pnl).toBe(0);
      expect(items[0].pnlPercent).toBe(0);
      expect(items[0].action).toBe('HOLD');
      expect(items[0].id).toContain('AAPL-');
    });
  });

  describe('updateItem (edit feature)', () => {
    it('updates buy price for average-down', () => {
      useWatchlistStore.setState({
        items: [makeItem({ id: 'edit-test', buyPrice: 150, quantity: 10 })],
      });

      // Simulate average down: bought more at lower price, new avg = 140
      useWatchlistStore.getState().updateItem('edit-test', {
        buyPrice: 140,
        quantity: 20,
      });

      const updated = useWatchlistStore.getState().items[0];
      expect(updated.buyPrice).toBe(140);
      expect(updated.quantity).toBe(20);
    });

    it('updates stop loss and take profit', () => {
      useWatchlistStore.setState({
        items: [makeItem({ id: 'sl-tp-test', stopLossPrice: null, takeProfitPrice: null })],
      });

      useWatchlistStore.getState().updateItem('sl-tp-test', {
        stopLossPrice: 130,
        takeProfitPrice: 200,
      });

      const updated = useWatchlistStore.getState().items[0];
      expect(updated.stopLossPrice).toBe(130);
      expect(updated.takeProfitPrice).toBe(200);
    });

    it('can clear optional fields by setting to null', () => {
      useWatchlistStore.setState({
        items: [makeItem({ id: 'clear-test', stopLossPrice: 130, takeProfitPrice: 200 })],
      });

      useWatchlistStore.getState().updateItem('clear-test', {
        stopLossPrice: null,
        takeProfitPrice: null,
      });

      const updated = useWatchlistStore.getState().items[0];
      expect(updated.stopLossPrice).toBeNull();
      expect(updated.takeProfitPrice).toBeNull();
    });

    it('updates buy date', () => {
      useWatchlistStore.setState({
        items: [makeItem({ id: 'date-test', buyDate: '2025-01-01' })],
      });

      useWatchlistStore.getState().updateItem('date-test', {
        buyDate: '2025-03-15',
      });

      const updated = useWatchlistStore.getState().items[0];
      expect(updated.buyDate).toBe('2025-03-15');
    });

    it('does not affect other items', () => {
      useWatchlistStore.setState({
        items: [
          makeItem({ id: 'item-1', symbol: 'AAPL', buyPrice: 150 }),
          makeItem({ id: 'item-2', symbol: 'MSFT', buyPrice: 300 }),
        ],
      });

      useWatchlistStore.getState().updateItem('item-1', { buyPrice: 140 });

      const items = useWatchlistStore.getState().items;
      expect(items[0].buyPrice).toBe(140);
      expect(items[1].buyPrice).toBe(300); // unchanged
    });

    it('no-ops for non-existent id', () => {
      useWatchlistStore.setState({
        items: [makeItem({ id: 'existing', buyPrice: 150 })],
      });

      useWatchlistStore.getState().updateItem('non-existent', { buyPrice: 999 });

      const items = useWatchlistStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].buyPrice).toBe(150);
    });
  });

  describe('removeItem', () => {
    it('removes the correct item', () => {
      useWatchlistStore.setState({
        items: [
          makeItem({ id: 'keep', symbol: 'AAPL' }),
          makeItem({ id: 'remove', symbol: 'MSFT' }),
        ],
      });

      useWatchlistStore.getState().removeItem('remove');

      const items = useWatchlistStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('keep');
    });
  });

  describe('clearAll', () => {
    it('removes all items', () => {
      useWatchlistStore.setState({
        items: [makeItem({ id: '1' }), makeItem({ id: '2' })],
      });

      useWatchlistStore.getState().clearAll();
      expect(useWatchlistStore.getState().items).toHaveLength(0);
    });
  });
});

// ============================================================
// P&L Calculations — Portfolio Store
// ============================================================

describe('P&L Calculations', () => {
  beforeEach(() => {
    usePortfolioStore.setState({ snapshots: [], closedPositions: [], lastSnapshotDate: null });
  });

  describe('calculateSummary with US stocks', () => {
    it('calculates correct P&L for US shares', () => {
      const items: WatchlistItem[] = [
        makeItem({ buyPrice: 150, currentPrice: 160, quantity: 10 }),
      ];

      const summary = usePortfolioStore.getState().calculateSummary(items);

      // US: invested = 150 * 10 = 1500, current = 160 * 10 = 1600
      expect(summary.us.totalInvested).toBe(1500);
      expect(summary.us.totalCurrentValue).toBe(1600);
      expect(summary.us.totalPnL).toBe(100);
      expect(summary.us.totalPnLPercent).toBeCloseTo(6.67, 1);
      expect(summary.us.positionCount).toBe(1);
      expect(summary.us.winnersCount).toBe(1);
    });

    it('handles losing US position', () => {
      const items: WatchlistItem[] = [
        makeItem({ buyPrice: 150, currentPrice: 140, quantity: 10 }),
      ];

      const summary = usePortfolioStore.getState().calculateSummary(items);

      expect(summary.us.totalPnL).toBe(-100);
      expect(summary.us.losersCount).toBe(1);
      expect(summary.us.winnersCount).toBe(0);
    });
  });

  describe('calculateSummary with ID stocks (lots)', () => {
    it('multiplies quantity by 100 for IDX lot-based stocks', () => {
      const items: WatchlistItem[] = [
        makeIDItem({ buyPrice: 9000, currentPrice: 9500, quantity: 5 }),
      ];

      const summary = usePortfolioStore.getState().calculateSummary(items);

      // ID: invested = 9000 * 5 * 100 = 4,500,000
      // ID: current = 9500 * 5 * 100 = 4,750,000
      expect(summary.id.totalInvested).toBe(4_500_000);
      expect(summary.id.totalCurrentValue).toBe(4_750_000);
      expect(summary.id.totalPnL).toBe(250_000);
      expect(summary.id.totalPnLPercent).toBeCloseTo(5.56, 1);
    });
  });

  describe('P&L after edit (average-down scenario)', () => {
    it('reflects updated buy price in portfolio summary', () => {
      // Initial: bought 10 shares at $150
      const initialItems: WatchlistItem[] = [
        makeItem({ buyPrice: 150, currentPrice: 145, quantity: 10 }),
      ];

      const before = usePortfolioStore.getState().calculateSummary(initialItems);
      // invested = 1500, current = 1450 => P&L = -50
      expect(before.us.totalPnL).toBe(-50);

      // After average down: now 20 shares at avg $140
      const editedItems: WatchlistItem[] = [
        makeItem({ buyPrice: 140, currentPrice: 145, quantity: 20 }),
      ];

      const after = usePortfolioStore.getState().calculateSummary(editedItems);
      // invested = 2800, current = 2900 => P&L = +100
      expect(after.us.totalPnL).toBe(100);
      expect(after.us.winnersCount).toBe(1);
      expect(after.us.losersCount).toBe(0);
    });

    it('reflects updated buy price for IDX lot-based stocks', () => {
      // Initial: 5 lots at Rp9000, price dropped to 8500
      const initialItems: WatchlistItem[] = [
        makeIDItem({ buyPrice: 9000, currentPrice: 8500, quantity: 5 }),
      ];

      const before = usePortfolioStore.getState().calculateSummary(initialItems);
      // invested = 9000*5*100=4,500,000, current = 8500*5*100=4,250,000 => P&L = -250,000
      expect(before.id.totalPnL).toBe(-250_000);

      // After average down: 10 lots at avg Rp8200
      const editedItems: WatchlistItem[] = [
        makeIDItem({ buyPrice: 8200, currentPrice: 8500, quantity: 10 }),
      ];

      const after = usePortfolioStore.getState().calculateSummary(editedItems);
      // invested = 8200*10*100=8,200,000, current = 8500*10*100=8,500,000 => P&L = +300,000
      expect(after.id.totalPnL).toBe(300_000);
      expect(after.id.winnersCount).toBe(1);
    });
  });

  describe('multiple positions across markets', () => {
    it('separates US and ID P&L correctly', () => {
      const items: WatchlistItem[] = [
        makeItem({ buyPrice: 100, currentPrice: 110, quantity: 5 }),  // US: +50
        makeIDItem({ buyPrice: 5000, currentPrice: 4800, quantity: 2 }), // ID: -40,000
      ];

      const summary = usePortfolioStore.getState().calculateSummary(items);

      expect(summary.us.totalPnL).toBe(50);
      expect(summary.id.totalPnL).toBe(-40_000);
      expect(summary.totalPositions).toBe(2);
    });
  });
});

// ============================================================
// buildClosedPositionFromWatchlistItem — P&L on close
// ============================================================

describe('buildClosedPositionFromWatchlistItem', () => {
  it('calculates correct P&L for US stock', () => {
    const item = makeItem({ buyPrice: 150, quantity: 10 });
    const result = buildClosedPositionFromWatchlistItem({ item, sellPrice: 170 });

    // (170-150) * 10 * 1 = 200
    expect(result.pnl).toBe(200);
    expect(result.pnlPercent).toBeCloseTo(13.33, 1);
    expect(result.quantity).toBe(10);
  });

  it('calculates correct P&L for IDX stock with lot multiplier', () => {
    const item = makeIDItem({ buyPrice: 9000, quantity: 5 });
    const result = buildClosedPositionFromWatchlistItem({ item, sellPrice: 9500 });

    // (9500-9000) * 5 * 100 = 250,000
    expect(result.pnl).toBe(250_000);
    expect(result.pnlPercent).toBeCloseTo(5.56, 1);
  });

  it('calculates correct P&L after average-down edit', () => {
    // Simulating: user edited from buyPrice=150/qty=10 to buyPrice=140/qty=20
    const item = makeItem({ buyPrice: 140, quantity: 20 });
    const result = buildClosedPositionFromWatchlistItem({ item, sellPrice: 155 });

    // (155-140) * 20 * 1 = 300
    expect(result.pnl).toBe(300);
    expect(result.pnlPercent).toBeCloseTo(10.71, 1);
  });

  it('detects stop-loss hit', () => {
    const item = makeItem({ buyPrice: 150, quantity: 10, stopLossPrice: 140 });
    const result = buildClosedPositionFromWatchlistItem({ item, sellPrice: 140 });

    expect(result.exitReason).toBe('STOP_LOSS');
    expect(result.followedPlan).toBe(true);
  });

  it('detects take-profit hit', () => {
    const item = makeItem({ buyPrice: 150, quantity: 10, takeProfitPrice: 200 });
    const result = buildClosedPositionFromWatchlistItem({ item, sellPrice: 200 });

    expect(result.exitReason).toBe('TAKE_PROFIT');
    expect(result.followedPlan).toBe(true);
  });

  it('marks manual exit when neither SL nor TP hit', () => {
    const item = makeItem({ buyPrice: 150, quantity: 10, stopLossPrice: 130, takeProfitPrice: 200 });
    const result = buildClosedPositionFromWatchlistItem({ item, sellPrice: 160 });

    expect(result.exitReason).toBe('MANUAL');
    expect(result.followedPlan).toBe(false);
  });
});
