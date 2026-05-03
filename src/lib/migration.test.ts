import { describe, it, expect } from 'vitest';
import { migratePortfolioState } from './portfolioStore';
import { migrateWatchlistState } from './watchlistStore';

describe('Schema Migrations', () => {
  describe('Portfolio Store Migration', () => {
    it('migrates v1 state (no FCDS-T fields) to v2 by adding null fields', () => {
      const v1State = {
        closedPositions: [
          {
            id: '1',
            symbol: 'AAPL',
            // Missing fcdstScoreAtBuy, fcdstScoreAtSell, lessonLearned, thesisAccuracy
          }
        ]
      };

      const v2State = migratePortfolioState(v1State, 1);
      
      expect(v2State.closedPositions[0]).toHaveProperty('fcdstScoreAtBuy', null);
      expect(v2State.closedPositions[0]).toHaveProperty('fcdstScoreAtSell', null);
      expect(v2State.closedPositions[0]).toHaveProperty('lessonLearned', null);
      expect(v2State.closedPositions[0]).toHaveProperty('thesisAccuracy', null);
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
  });

  describe('Watchlist Store Migration', () => {
    it('migrates v1 state to v2 by adding null FCDS-T fields', () => {
      const v1State = {
        items: [
          {
            id: '1',
            symbol: 'AAPL',
            // Missing fcdstScore, thesis
          }
        ]
      };

      const v2State = migrateWatchlistState(v1State, 1);
      
      expect(v2State.items[0]).toHaveProperty('fcdstScore', null);
      expect(v2State.items[0]).toHaveProperty('thesis', null);
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
  });
});
