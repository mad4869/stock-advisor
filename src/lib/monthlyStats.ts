import { ClosedPosition, PortfolioSnapshot, PositionSnapshot, WatchlistItem, Market } from '@/types';

export interface MonthlyStats {
    month: string;            // 'YYYY-MM'
    label: string;            // 'Jan 2025'
    realizedPnl: number;      // from closed positions (sold in this month)
    floatingPnlDelta: number; // change in total unrealized P&L DURING this month
    trades: number;           // closed trades count
    wins: number;
    losses: number;
    winRate: number;
    openPositions: number;    // positions open at end of month
    hasFloatingData: boolean; // whether snapshot data exists for this month
}

/**
 * Get the YYYY-MM string for the month before `month`.
 * e.g. '2024-06' → '2024-05', '2024-01' → '2023-12'
 * Uses pure arithmetic to avoid timezone issues with Date.
 */
function prevMonth(month: string): string {
    let [y, m] = month.split('-').map(Number);
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
    return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Build monthly stats with:
 * - Realized P&L: grouped by sellDate month
 * - Unrealized P&L DELTA: how much total unrealized changed DURING each month,
 *   **adjusted for positions that were closed** (their prior-month unrealized is
 *   removed from the baseline so that closing a position doesn't create a fake
 *   negative delta).
 *
 * Formula per month M:
 *   closedAdj = sum of (end-of-(M-1) unrealized) for each position closed in M
 *   adjustedPrev = prevMonthTotalUnrealized - closedAdj
 *   delta = endOfMonthUnrealized - adjustedPrev
 */
export function buildCombinedMonthlyStats(
    closedPositions: ClosedPosition[],
    snapshots: PortfolioSnapshot[],
    watchlistItems: WatchlistItem[],
    market: Market,
    /** Override "today" for testing — defaults to new Date() */
    today: Date = new Date(),
): MonthlyStats[] {
    // --- Realized: group by sellDate month ---
    const realMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
    const closedByMonth = new Map<string, ClosedPosition[]>();
    closedPositions
        .filter((p) => p.market === market)
        .forEach((p) => {
            const month = p.sellDate.slice(0, 7);
            // Realized aggregation
            const e = realMap.get(month) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
            realMap.set(month, {
                pnl: e.pnl + p.pnl,
                trades: e.trades + 1,
                wins: e.wins + (p.pnlPercent >= 0 ? 1 : 0),
                losses: e.losses + (p.pnlPercent < 0 ? 1 : 0),
            });
            // Group closed positions by month for adjustment later
            const list = closedByMonth.get(month) ?? [];
            list.push(p);
            closedByMonth.set(month, list);
        });

    // --- Snapshot data ---
    // End-of-month total unrealized and position count
    const endOfMonthUnrealized = new Map<string, { pnl: number; count: number }>();
    // Last snapshot's per-position data for each month (for closed-position adjustment)
    const lastSnapshotPositions = new Map<string, PositionSnapshot[]>();

    snapshots.forEach((s) => {
        const month = s.date.slice(0, 7);
        const mktData = market === 'US' ? s.us : s.id;
        if (!mktData || typeof mktData.totalPnL !== 'number') return;
        // Overwrite: snapshots are chronological, so last one in each month wins
        endOfMonthUnrealized.set(month, { pnl: mktData.totalPnL, count: mktData.positionCount || 0 });
        // Store per-position data for this market
        const mktPositions = (s.positions || []).filter((p) => p.market === market);
        lastSnapshotPositions.set(month, mktPositions);
    });

    // For the current month, use live watchlist data
    const currentMonth = today.toISOString().slice(0, 7);
    const marketItems = watchlistItems.filter((i) => i.market === market);
    if (marketItems.length > 0) {
        const multiplier = market === 'ID' ? 100 : 1;
        const liveUnrealized = marketItems.reduce(
            (sum, i) => sum + (i.currentPrice - i.buyPrice) * i.quantity * multiplier,
            0,
        );
        endOfMonthUnrealized.set(currentMonth, { pnl: liveUnrealized, count: marketItems.length });
    }

    // --- Compute adjustment for closed positions ---
    // For month M, find positions closed in M and look up their unrealized at end of M-1.
    // This amount is subtracted from the prev-month baseline so that closing a position
    // doesn't create a fake negative delta.
    function getClosedPositionAdjustment(month: string): number {
        const closedInMonth = closedByMonth.get(month);
        if (!closedInMonth || closedInMonth.length === 0) return 0;

        const prev = prevMonth(month);
        const prevPositions = lastSnapshotPositions.get(prev);
        if (!prevPositions || prevPositions.length === 0) return 0;

        let adjustment = 0;
        // Track which snapshot positions have been matched to avoid double-matching
        const usedIndices = new Set<number>();

        for (const closed of closedInMonth) {
            // Find the best match in previous month's snapshot by symbol + buyPrice
            const matchIdx = prevPositions.findIndex((p, idx) =>
                !usedIndices.has(idx) &&
                p.symbol === closed.symbol &&
                Math.abs(p.buyPrice - closed.buyPrice) < 0.01
            );
            if (matchIdx >= 0) {
                adjustment += prevPositions[matchIdx].pnl;
                usedIndices.add(matchIdx);
            }
        }
        return adjustment;
    }

    // Sort snapshot months and compute adjusted month-over-month deltas
    const snapshotMonthsSorted = Array.from(endOfMonthUnrealized.keys()).sort();
    const unrealizedDeltaMap = new Map<string, { delta: number; endCount: number }>();
    for (let i = 0; i < snapshotMonthsSorted.length; i++) {
        const month = snapshotMonthsSorted[i];
        const endPnl = endOfMonthUnrealized.get(month)!.pnl;
        const endCount = endOfMonthUnrealized.get(month)!.count;
        const rawPrevPnl = i > 0 ? (endOfMonthUnrealized.get(snapshotMonthsSorted[i - 1])?.pnl ?? 0) : 0;

        // Subtract the prior-month unrealized of positions closed this month
        const closedAdj = getClosedPositionAdjustment(month);
        const adjustedPrevPnl = rawPrevPnl - closedAdj;

        unrealizedDeltaMap.set(month, { delta: endPnl - adjustedPrevPnl, endCount });
    }

    // --- Union of all months ---
    const allMonths = Array.from(new Set([...realMap.keys(), ...unrealizedDeltaMap.keys()])).sort();

    return allMonths.map((month) => {
        const r = realMap.get(month) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
        const u = unrealizedDeltaMap.get(month);
        return {
            month,
            label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            realizedPnl: r.pnl,
            floatingPnlDelta: u?.delta ?? 0,
            trades: r.trades,
            wins: r.wins,
            losses: r.losses,
            winRate: r.trades > 0 ? (r.wins / r.trades) * 100 : 0,
            openPositions: u?.endCount ?? 0,
            hasFloatingData: u != null,
        };
    });
}
