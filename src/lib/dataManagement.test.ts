import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportAllData, importAllData } from './dataManagement';
import { usePortfolioStore } from './portfolioStore';
import { useWatchlistStore } from './watchlistStore';

describe('Data Management - Backup & Import', () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      snapshots: [],
      closedPositions: [],
      lastSnapshotDate: null,
    });
    useWatchlistStore.setState({ items: [] });
  });

  it('exportAllData generates valid JSON with all stores, version, and timestamp', () => {
    useWatchlistStore.setState({
      items: [{
        id: '1', symbol: 'AAPL', market: 'US', name: 'Apple', buyPrice: 150, currentPrice: 155,
        pnl: 5, pnlPercent: 3.33, action: 'HOLD', actionReason: '', lastUpdated: '', quantity: 10
      }]
    });

    const jsonStr = exportAllData();
    const parsed = JSON.parse(jsonStr);

    expect(parsed).toHaveProperty('exportVersion', 1);
    expect(parsed).toHaveProperty('exportDate');
    expect(parsed.data.watchlist.items).toHaveLength(1);
    expect(parsed.data.watchlist.items[0].symbol).toBe('AAPL');
  });

  it('importAllData correctly loads state from a valid JSON string', () => {
    const backupJson = JSON.stringify({
      exportVersion: 1,
      exportDate: Date.now(),
      data: {
        portfolio: {
          snapshots: [],
          closedPositions: [{
             id: 'c1', symbol: 'MSFT', market: 'US', name: 'Microsoft', buyPrice: 200, sellPrice: 250,
             sellDate: '2025-01-01', buyDate: '2024-01-01', quantity: 10, pnl: 500, pnlPercent: 25
          }],
          lastSnapshotDate: null,
        },
        watchlist: { items: [] },
        banking: { metrics: {} },
        story: { analyses: {} },
        preferences: { analysisMode: 'advanced' },
      }
    });

    const success = importAllData(backupJson);
    expect(success).toBe(true);

    const portfolio = usePortfolioStore.getState();
    expect(portfolio.closedPositions).toHaveLength(1);
    expect(portfolio.closedPositions[0].symbol).toBe('MSFT');
  });

  it('importAllData returns false for invalid JSON', () => {
    const success = importAllData('invalid json');
    expect(success).toBe(false);
  });
});
