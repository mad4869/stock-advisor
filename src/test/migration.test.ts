import { describe, it, expect } from 'vitest';
import { migratePortfolioState, CURRENT_SCHEMA_VERSION as PORTFOLIO_VERSION } from '@/lib/portfolioStore';
import { migrateWatchlistState, CURRENT_SCHEMA_VERSION as WATCHLIST_VERSION } from '@/lib/watchlistStore';

describe('Schema Migrations', () => {
  describe('Portfolio Store Migration', () => {
    it('migrates v1 state by filtering old-format snapshots', () => {
      const v1State = {
        snapshots: [
          { date: '2023-01-01', us: {}, id: {} },
          { date: '2023-01-02', total: 100 },
        ],
        closedPositions: [
          {
            id: '1',
            symbol: 'AAPL',
          }
        ]
      };

      const v2State = migratePortfolioState(v1State, 1);
      
      expect(v2State.snapshots).toHaveLength(1);
      expect(v2State.snapshots[0].date).toBe('2023-01-01');
      expect(v2State.closedPositions[0]).toEqual({ id: '1', symbol: 'AAPL' });
    });

    it('v2 state -> no change (idempotent)', () => {
      const v2State = {
        closedPositions: [
          {
            id: '1',
            symbol: 'AAPL',
            fcdstScoreAtBuy: { totalScore: 10, grade: 'B', snapshotDate: 123 },
            fcdstScoreAtSell: null,
            lessonLearned: 'Test lesson',
            thesisAccuracy: 'correct'
          }
        ]
      };

      const migratedState = migratePortfolioState(v2State, 2);
      
      expect(migratedState).toEqual(v2State);
    });

    it('filters out old-format snapshots that cannot be migrated', () => {
      const stateWithOldSnapshots = {
        snapshots: [
          { date: '2023-01-01', us: {}, id: {} },
          { date: '2023-01-02', total: 100 },
          { date: '2023-01-03', us: {}, id: {} }
        ],
        closedPositions: []
      };

      const result = migratePortfolioState(stateWithOldSnapshots, 1);
      expect(result.snapshots).toHaveLength(2);
      expect(result.snapshots[0].date).toBe('2023-01-01');
      expect(result.snapshots[1].date).toBe('2023-01-03');
    });

    it('handles empty snapshots array', () => {
      const state = {
        snapshots: [],
        closedPositions: []
      };

      const result = migratePortfolioState(state, 1);
      expect(result.snapshots).toEqual([]);
    });

    it('handles null snapshots gracefully', () => {
      const state = {
        snapshots: null,
        closedPositions: []
      };

      const result = migratePortfolioState(state, 1);
      expect(result).toBeDefined();
    });

    it('preserves closedPositions during migration', () => {
      const state = {
        snapshots: [],
        closedPositions: [
          { id: '1', symbol: 'AAPL', pnl: 100 }
        ]
      };

      const result = migratePortfolioState(state, 1);
      expect(result.closedPositions).toHaveLength(1);
      expect(result.closedPositions[0].symbol).toBe('AAPL');
    });
  });

  describe('Watchlist Store Migration', () => {
    it('migrates v1 state to v2 by returning state as-is', () => {
      const v1State = {
        items: [
          {
            id: '1',
            symbol: 'AAPL',
          }
        ]
      };

      const v2State = migrateWatchlistState(v1State, 1);
      
      expect(v2State.items[0]).toEqual({ id: '1', symbol: 'AAPL' });
    });

    it('v2 state -> no change (idempotent)', () => {
      const v2State = {
        items: [
          {
            id: '1',
            symbol: 'AAPL',
            fcdstScore: { totalScore: 10, grade: 'B', fScore: 3, cScore: 2, dScore: { passed: true, npl: 1, car: 20 }, sScore: null, snapshotDate: 123 },
            thesis: null
          }
        ]
      };

      const migratedState = migrateWatchlistState(v2State, 2);
      
      expect(migratedState).toEqual(v2State);
    });

    it('handles empty items array', () => {
      const state = {
        items: []
      };

      const result = migrateWatchlistState(state, 1);
      expect(result.items).toEqual([]);
    });

    it('preserves all item fields during migration', () => {
      const state = {
        items: [
          {
            id: '1',
            symbol: 'AAPL',
            buyPrice: 150,
            quantity: 10,
            market: 'US'
          }
        ]
      };

      const result = migrateWatchlistState(state, 1);
      expect(result.items[0].buyPrice).toBe(150);
      expect(result.items[0].quantity).toBe(10);
      expect(result.items[0].market).toBe('US');
    });
  });

  describe('Schema versions', () => {
    it('portfolio store should be at version 2', () => {
      expect(PORTFOLIO_VERSION).toBe(2);
    });

    it('watchlist store should be at version 2', () => {
      expect(WATCHLIST_VERSION).toBe(2);
    });
  });
});
