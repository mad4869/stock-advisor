import { ClosedPosition, PortfolioSnapshot, WatchlistItem, Market } from '@/types';

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
 * Build monthly stats with:
 * - Realized P&L: grouped by sellDate month
 * - Unrealized P&L DELTA: how much total unrealized changed DURING each month.
 *   Computed by: (end-of-month snapshot unrealized) - (end-of-previous-month snapshot unrealized).
 *   Each month starts from zero. For the current month, live watchlist data is used.
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
    closedPositions
        .filter((p) => p.market === market)
        .forEach((p) => {
            const month = p.sellDate.slice(0, 7);
            const e = realMap.get(month) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
            realMap.set(month, {
                pnl: e.pnl + p.pnl,
                trades: e.trades + 1,
                wins: e.wins + (p.pnlPercent >= 0 ? 1 : 0),
                losses: e.losses + (p.pnlPercent < 0 ? 1 : 0),
            });
        });

    // --- Unrealized snapshots: end-of-month total unrealized and position count ---
    // Take the LAST snapshot of each month for this market (snapshots are chronological)
    const endOfMonthUnrealized = new Map<string, { pnl: number; count: number }>();
    snapshots.forEach((s) => {
        const month = s.date.slice(0, 7);
        const mktData = market === 'US' ? s.us : s.id;
        if (!mktData || typeof mktData.totalPnL !== 'number') return;
        endOfMonthUnrealized.set(month, { pnl: mktData.totalPnL, count: mktData.positionCount || 0 });
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

    // Sort snapshot months and compute month-over-month deltas
    const snapshotMonthsSorted = Array.from(endOfMonthUnrealized.keys()).sort();
    const unrealizedDeltaMap = new Map<string, { delta: number; endCount: number }>();
    for (let i = 0; i < snapshotMonthsSorted.length; i++) {
        const month = snapshotMonthsSorted[i];
        const endPnl = endOfMonthUnrealized.get(month)!.pnl;
        const endCount = endOfMonthUnrealized.get(month)!.count;
        const prevPnl = i > 0 ? (endOfMonthUnrealized.get(snapshotMonthsSorted[i - 1])?.pnl ?? 0) : 0;
        unrealizedDeltaMap.set(month, { delta: endPnl - prevPnl, endCount });
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
