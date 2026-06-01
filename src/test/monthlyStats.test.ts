import { describe, it, expect } from 'vitest';
import { buildCombinedMonthlyStats } from '@/lib/monthlyStats';
import { ClosedPosition, PortfolioSnapshot, PositionSnapshot, WatchlistItem } from '@/types';

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
    buyPrice = 100,
): ClosedPosition {
    return {
        id,
        symbol: id,
        market,
        name: id,
        buyPrice,
        buyDate: '2024-01-01',
        sellPrice: buyPrice + pnl,
        sellDate,
        quantity: 1,
        pnl,
        pnlPercent,
    };
}

function mkPosSnap(symbol: string, buyPrice: number, currentPrice: number, quantity = 1, market: 'US' | 'ID' = 'US'): PositionSnapshot {
    const invested = buyPrice * quantity;
    const currentValue = currentPrice * quantity;
    return {
        symbol,
        market,
        buyPrice,
        currentPrice,
        quantity,
        invested,
        currentValue,
        pnl: currentValue - invested,
        pnlPercent: ((currentPrice - buyPrice) / buyPrice) * 100,
    };
}

function mkSnapshot(date: string, usTotalPnL: number, usCount = 1, positions: PositionSnapshot[] = []): PortfolioSnapshot {
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
        positions,
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

    it('Case 1 – user example: delta resets each month', () => {
        const closed = [mkClosed('A', '2024-05-20', 5, 5)];

        const snapshots = [mkSnapshot('2024-05-31', 5, 1, [
            mkPosSnap('B', 100, 105),
        ])];

        const open = [mkOpenPosition('B', 100, 110)];
        const today = makeDate('2024-06-15');

        const result = buildCombinedMonthlyStats(closed, snapshots, open, 'US', today);

        expect(result).toHaveLength(2);

        const may = result.find(r => r.month === '2024-05');
        const jun = result.find(r => r.month === '2024-06');

        expect(may).toBeDefined();
        expect(may!.realizedPnl).toBe(5);
        expect(may!.floatingPnlDelta).toBe(5);
        expect(may!.hasFloatingData).toBe(true);

        expect(jun).toBeDefined();
        expect(jun!.realizedPnl).toBe(0);
        expect(jun!.floatingPnlDelta).toBe(5);
        expect(jun!.hasFloatingData).toBe(true);
    });

    it('Case 2 – unrealized can go negative in a month', () => {
        const snapshots = [
            mkSnapshot('2024-01-31', 20, 1, [mkPosSnap('X', 100, 120)]),
            mkSnapshot('2024-02-29', 8, 1, [mkPosSnap('X', 100, 108)]),
        ];
        const open = [mkOpenPosition('X', 100, 115)];
        const today = makeDate('2024-03-20');

        const result = buildCombinedMonthlyStats([], snapshots, open, 'US', today);

        expect(result).toHaveLength(3);
        expect(result[0].floatingPnlDelta).toBeCloseTo(20);
        expect(result[1].floatingPnlDelta).toBeCloseTo(-12);
        expect(result[2].floatingPnlDelta).toBeCloseTo(7);
    });

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

    it('Case 4 – month with only open positions and zero realized', () => {
        const open = [mkOpenPosition('C', 100, 108)];
        const today = makeDate('2024-07-15');

        const result = buildCombinedMonthlyStats([], [], open, 'US', today);

        expect(result).toHaveLength(1);
        const jul = result[0];
        expect(jul.month).toBe('2024-07');
        expect(jul.realizedPnl).toBe(0);
        expect(jul.trades).toBe(0);
        expect(jul.floatingPnlDelta).toBeCloseTo(8);
        expect(jul.hasFloatingData).toBe(true);
    });

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

    it('Case 6 – last snapshot per month is used (not first)', () => {
        const snapshots = [
            mkSnapshot('2024-05-15', 3),
            mkSnapshot('2024-05-31', 9),
        ];
        const today = makeDate('2024-06-01');

        const result = buildCombinedMonthlyStats([], snapshots, [], 'US', today);

        const may = result.find(r => r.month === '2024-05');
        expect(may).toBeDefined();
        expect(may!.floatingPnlDelta).toBeCloseTo(9);
    });

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

    it('Case 8 – empty inputs produce empty result', () => {
        const result = buildCombinedMonthlyStats([], [], [], 'US', makeDate('2024-01-15'));
        expect(result).toHaveLength(0);
    });

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

    // ═══════════════════════════════════════════════════════════════════
    // CLOSED-POSITION ADJUSTMENT TESTS
    // ═══════════════════════════════════════════════════════════════════

    // CASE 11: User's exact closing scenario
    // May:  A (+$5) + B (+$3) = $8 total unrealized
    // June: B closed (realized +$3). A still at +$5.
    // Expected: Jun Δ = $0 (not -$3)
    it('Case 11 – closing a position does NOT create fake negative delta', () => {
        const closed = [mkClosed('B', '2024-06-10', 3, 3, 'US', 100)];

        const snapshots = [
            mkSnapshot('2024-05-31', 8, 2, [
                mkPosSnap('A', 100, 105),
                mkPosSnap('B', 100, 103),
            ]),
        ];

        const open = [mkOpenPosition('A', 100, 105)];
        const today = makeDate('2024-06-15');

        const result = buildCombinedMonthlyStats(closed, snapshots, open, 'US', today);

        const may = result.find(r => r.month === '2024-05');
        const jun = result.find(r => r.month === '2024-06');

        expect(may!.floatingPnlDelta).toBeCloseTo(8);
        expect(jun!.realizedPnl).toBe(3);
        expect(jun!.floatingPnlDelta).toBeCloseTo(0);
    });

    // CASE 12: Closing + held stock price drop
    // May:  A (+$5) + B (+$3) = $8
    // June: B closed. A drops to +$2. → Jun Δ = -$3 (real loss on A)
    it('Case 12 – closing + real price drop on held stock separates correctly', () => {
        const closed = [mkClosed('B', '2024-06-10', 3, 3, 'US', 100)];

        const snapshots = [
            mkSnapshot('2024-05-31', 8, 2, [
                mkPosSnap('A', 100, 105),
                mkPosSnap('B', 100, 103),
            ]),
        ];

        const open = [mkOpenPosition('A', 100, 102)];
        const today = makeDate('2024-06-15');

        const result = buildCombinedMonthlyStats(closed, snapshots, open, 'US', today);
        const jun = result.find(r => r.month === '2024-06');

        expect(jun!.realizedPnl).toBe(3);
        expect(jun!.floatingPnlDelta).toBeCloseTo(-3);
    });

    // CASE 13: Closing in first month (no prior snapshot) → no adjustment
    it('Case 13 – closing in first month with no prior snapshot: no adjustment', () => {
        const closed = [mkClosed('X', '2024-01-15', 10, 10, 'US', 100)];

        const snapshots = [
            mkSnapshot('2024-01-31', 20, 1, [
                mkPosSnap('Y', 100, 120),
            ]),
        ];
        const today = makeDate('2024-02-01');

        const result = buildCombinedMonthlyStats(closed, snapshots, [], 'US', today);
        const jan = result.find(r => r.month === '2024-01');

        expect(jan!.realizedPnl).toBe(10);
        expect(jan!.floatingPnlDelta).toBeCloseTo(20);
    });

    // CASE 14: Multiple lots of same symbol, only one closed → match by buyPrice
    it('Case 14 – multiple lots of same symbol, only one closed: correct match by buyPrice', () => {
        const closed: ClosedPosition[] = [{
            id: 'AAPL-1', symbol: 'AAPL', market: 'US', name: 'Apple',
            buyPrice: 100, buyDate: '2024-01-01', sellPrice: 110,
            sellDate: '2024-06-10', quantity: 1, pnl: 10, pnlPercent: 10,
        }];

        const snapshots = [
            mkSnapshot('2024-05-31', 20, 2, [
                mkPosSnap('AAPL', 100, 110),
                mkPosSnap('AAPL', 150, 160),
            ]),
        ];

        const open: WatchlistItem[] = [{
            id: 'AAPL-2', symbol: 'AAPL', market: 'US', name: 'Apple',
            buyPrice: 150, buyDate: '2024-01-01', quantity: 1,
            currentPrice: 160, pnl: 10, pnlPercent: 6.67,
            action: 'HOLD', actionReason: '', lastUpdated: new Date().toISOString(),
        }];

        const today = makeDate('2024-06-15');
        const result = buildCombinedMonthlyStats(closed, snapshots, open, 'US', today);
        const jun = result.find(r => r.month === '2024-06');

        expect(jun!.realizedPnl).toBe(10);
        expect(jun!.floatingPnlDelta).toBeCloseTo(0);
    });
});
