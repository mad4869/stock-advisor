import { describe, it, expect } from 'vitest';
import { buildCombinedMonthlyStats } from '@/lib/monthlyStats';
import { ClosedPosition, PortfolioSnapshot, WatchlistItem } from '@/types';

// ─── helpers ───────────────────────────────────────────────────────────────

function makeDate(today: string) {
    return new Date(today + 'T12:00:00Z');
}

function mkClosed(
    id: string,
    sellDate: string,
    pnl: number,
    pnlPercent: number,
    market: 'US' | 'ID' = 'US',
): ClosedPosition {
    return {
        id,
        symbol: id,
        market,
        name: id,
        buyPrice: 100,
        buyDate: '2024-01-01',
        sellPrice: 100 + pnl,
        sellDate,
        quantity: 1,
        pnl,
        pnlPercent,
    };
}

function mkSnapshot(date: string, usTotalPnL: number, usCount = 1): PortfolioSnapshot {
    return {
        date,
        timestamp: date + 'T23:00:00Z',
        us: {
            totalInvested: 1000,
            totalCurrentValue: 1000 + usTotalPnL,
            totalPnL: usTotalPnL,
            totalPnLPercent: usTotalPnL / 10,
            positionCount: usCount,
        },
        id: {
            totalInvested: 0,
            totalCurrentValue: 0,
            totalPnL: 0,
            totalPnLPercent: 0,
            positionCount: 0,
        },
        positions: [],
    };
}

function mkOpenPosition(id: string, buyPrice: number, currentPrice: number, quantity = 1): WatchlistItem {
    const pnl = (currentPrice - buyPrice) * quantity;
    return {
        id,
        symbol: id,
        market: 'US',
        name: id,
        buyPrice,
        buyDate: '2024-01-01',
        quantity,
        currentPrice,
        pnl,
        pnlPercent: ((currentPrice - buyPrice) / buyPrice) * 100,
        action: 'HOLD',
        actionReason: '',
        lastUpdated: new Date().toISOString(),
    };
}

// ─── test suite ────────────────────────────────────────────────────────────

describe('buildCombinedMonthlyStats', () => {

    // ──────────────────────────────────────────────────────────────────
    // CASE 1: Exact user example
    // May: Stock A closed +$5, Stock B open at +$5
    // Jun: Stock B still open at +$10 (no new closes)
    // Expected:
    //   May → realized +$5, unrealizedΔ +$5  (end-of-May $5 - prev $0)
    //   Jun → realized  $0, unrealizedΔ +$5  (end-of-Jun $10 - end-of-May $5)
    // ──────────────────────────────────────────────────────────────────
    it('Case 1 – user example: delta resets each month', () => {
        const closed = [mkClosed('A', '2024-05-20', 5, 5)];

        // One snapshot at end of May: total unrealized = $5 (Stock B)
        const snapshots = [mkSnapshot('2024-05-31', 5)];

        // Current live data: Stock B now at +$10 (today = June)
        const open = [mkOpenPosition('B', 100, 110)]; // pnl = $10
        const today = makeDate('2024-06-15');

        const result = buildCombinedMonthlyStats(closed, snapshots, open, 'US', today);

        expect(result).toHaveLength(2);

        const may = result.find(r => r.month === '2024-05');
        const jun = result.find(r => r.month === '2024-06');

        expect(may).toBeDefined();
        expect(may!.realizedPnl).toBe(5);
        expect(may!.floatingPnlDelta).toBe(5);   // 5 - 0 = +5
        expect(may!.hasFloatingData).toBe(true);

        expect(jun).toBeDefined();
        expect(jun!.realizedPnl).toBe(0);
        expect(jun!.floatingPnlDelta).toBe(5);   // 10 - 5 = +5
        expect(jun!.hasFloatingData).toBe(true);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 2: Multiple months, unrealized goes negative in one month
    // Jan: open positions end at +$20  → Δ = +20
    // Feb: positions drop to +$8       → Δ = -12  (8 - 20)
    // Mar: positions recover to +$15   → Δ = +7   (15 - 8)
    // ──────────────────────────────────────────────────────────────────
    it('Case 2 – unrealized can go negative in a month', () => {
        const snapshots = [
            mkSnapshot('2024-01-31', 20),
            mkSnapshot('2024-02-29', 8),
        ];
        const open = [mkOpenPosition('X', 100, 115)]; // pnl = $15 in March
        const today = makeDate('2024-03-20');

        const result = buildCombinedMonthlyStats([], snapshots, open, 'US', today);

        expect(result).toHaveLength(3);
        expect(result[0].floatingPnlDelta).toBeCloseTo(20);   // Jan: 20 - 0
        expect(result[1].floatingPnlDelta).toBeCloseTo(-12);  // Feb: 8 - 20
        expect(result[2].floatingPnlDelta).toBeCloseTo(7);    // Mar: 15 - 8
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 3: Multiple closed trades in the same month
    // Two trades close in April: +$30 win, -$10 loss → realized = +$20, winRate = 50%
    // ──────────────────────────────────────────────────────────────────
    it('Case 3 – multiple closed trades in same month aggregate correctly', () => {
        const closed = [
            mkClosed('W1', '2024-04-10', 30, 30),
            mkClosed('L1', '2024-04-25', -10, -10),
        ];
        const today = makeDate('2024-04-30');

        const result = buildCombinedMonthlyStats(closed, [], [], 'US', today);

        expect(result).toHaveLength(1);
        const apr = result[0];
        expect(apr.realizedPnl).toBe(20);
        expect(apr.trades).toBe(2);
        expect(apr.wins).toBe(1);
        expect(apr.losses).toBe(1);
        expect(apr.winRate).toBe(50);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 4: Month with only open positions and no closed trades
    // Realized = $0, hasFloatingData = true, floatingPnlDelta = live unrealized
    // ──────────────────────────────────────────────────────────────────
    it('Case 4 – month with only open positions and zero realized', () => {
        const open = [mkOpenPosition('C', 100, 108)]; // $8 unrealized
        const today = makeDate('2024-07-15');

        const result = buildCombinedMonthlyStats([], [], open, 'US', today);

        expect(result).toHaveLength(1);
        const jul = result[0];
        expect(jul.month).toBe('2024-07');
        expect(jul.realizedPnl).toBe(0);
        expect(jul.trades).toBe(0);
        expect(jul.floatingPnlDelta).toBeCloseTo(8);  // 8 - 0 (no prior month)
        expect(jul.hasFloatingData).toBe(true);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 5: Month with only closed trades and NO open positions
    // floatingPnlDelta = 0, hasFloatingData = false
    // ──────────────────────────────────────────────────────────────────
    it('Case 5 – month with only realized and no open positions', () => {
        const closed = [mkClosed('D', '2024-08-15', 50, 50)];
        const today = makeDate('2024-08-31');

        const result = buildCombinedMonthlyStats(closed, [], [], 'US', today);

        expect(result).toHaveLength(1);
        const aug = result[0];
        expect(aug.realizedPnl).toBe(50);
        expect(aug.floatingPnlDelta).toBe(0);
        expect(aug.hasFloatingData).toBe(false);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 6: Multiple snapshots in same month — last one wins
    // Mid-May snapshot: $3, End-May snapshot: $9 → delta should use $9
    // ──────────────────────────────────────────────────────────────────
    it('Case 6 – last snapshot per month is used (not first)', () => {
        const snapshots = [
            mkSnapshot('2024-05-15', 3),   // mid-month: $3
            mkSnapshot('2024-05-31', 9),   // end-of-month: $9 ← should win
        ];
        const today = makeDate('2024-06-01');

        const result = buildCombinedMonthlyStats([], snapshots, [], 'US', today);

        const may = result.find(r => r.month === '2024-05');
        expect(may).toBeDefined();
        expect(may!.floatingPnlDelta).toBeCloseTo(9); // 9 - 0
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 7: Market isolation — ID trades/snapshots don't appear in US query
    // ──────────────────────────────────────────────────────────────────
    it('Case 7 – US and ID data are isolated correctly', () => {
        const closed = [
            mkClosed('US1', '2024-03-10', 100, 10, 'US'),
            mkClosed('ID1', '2024-03-10', 500_000, 5, 'ID'),
        ];
        const today = makeDate('2024-03-31');

        const usResult = buildCombinedMonthlyStats(closed, [], [], 'US', today);
        const idResult = buildCombinedMonthlyStats(closed, [], [], 'ID', today);

        expect(usResult[0].realizedPnl).toBe(100);
        expect(idResult[0].realizedPnl).toBe(500_000);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 8: Empty inputs → empty result
    // ──────────────────────────────────────────────────────────────────
    it('Case 8 – empty inputs produce empty result', () => {
        const result = buildCombinedMonthlyStats([], [], [], 'US', makeDate('2024-01-15'));
        expect(result).toHaveLength(0);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 9: Results are sorted oldest → newest
    // ──────────────────────────────────────────────────────────────────
    it('Case 9 – results are sorted chronologically (oldest first)', () => {
        const closed = [
            mkClosed('Z1', '2024-06-01', 10, 10),
            mkClosed('Z2', '2024-03-01', 20, 20),
            mkClosed('Z3', '2024-09-01', 30, 30),
        ];
        const today = makeDate('2024-09-30');

        const result = buildCombinedMonthlyStats(closed, [], [], 'US', today);

        expect(result.map(r => r.month)).toEqual(['2024-03', '2024-06', '2024-09']);
    });

    // ──────────────────────────────────────────────────────────────────
    // CASE 10: Position count at end of month is correct
    // May: 2 positions open, Jun: 1 position added = 3 total
    // ──────────────────────────────────────────────────────────────────
    it('Case 10 – openPositions count reflects live watchlist size', () => {
        const open = [
            mkOpenPosition('P1', 100, 110),
            mkOpenPosition('P2', 200, 220),
            mkOpenPosition('P3', 50, 55),
        ]; // 3 positions open in current month
        const today = makeDate('2024-06-20');

        const result = buildCombinedMonthlyStats([], [], open, 'US', today);

        const jun = result.find(r => r.month === '2024-06');
        expect(jun!.openPositions).toBe(3);
    });
});
