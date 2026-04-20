import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    PortfolioSnapshot,
    ClosedPosition,
    WatchlistItem,
    Market,
    MarketPnL,
    PortfolioSummary,
    MarketSnapshotData,
} from '@/types';

function emptyMarketPnL(market: Market): MarketPnL {
    return {
        market,
        currency: market === 'ID' ? 'IDR' : 'USD',
        totalInvested: 0,
        totalCurrentValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        positionCount: 0,
        winnersCount: 0,
        losersCount: 0,
        winRate: 0,
        bestPerformer: null,
        worstPerformer: null,
    };
}

function emptyMarketSnapshot(): MarketSnapshotData {
    return {
        totalInvested: 0,
        totalCurrentValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        positionCount: 0,
    };
}

function calculateMarketPnL(items: WatchlistItem[], market: Market): MarketPnL {
    const filtered = items.filter((i) => i.market === market);

    if (filtered.length === 0) return emptyMarketPnL(market);

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let winnersCount = 0;
    let losersCount = 0;
    let bestPerformer: { symbol: string; pnlPercent: number } | null = null;
    let worstPerformer: { symbol: string; pnlPercent: number } | null = null;

    for (const item of filtered) {
        const multiplier = market === 'ID' ? 100 : 1;
        const invested = item.buyPrice * item.quantity * multiplier;
        const currentValue = item.currentPrice * item.quantity * multiplier;
        const pnlPercent = ((item.currentPrice - item.buyPrice) / item.buyPrice) * 100;

        totalInvested += invested;
        totalCurrentValue += currentValue;

        if (pnlPercent >= 0) winnersCount++;
        else losersCount++;

        if (!bestPerformer || pnlPercent > bestPerformer.pnlPercent) {
            bestPerformer = { symbol: item.symbol, pnlPercent };
        }
        if (!worstPerformer || pnlPercent < worstPerformer.pnlPercent) {
            worstPerformer = { symbol: item.symbol, pnlPercent };
        }
    }

    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
        market,
        currency: market === 'ID' ? 'IDR' : 'USD',
        totalInvested,
        totalCurrentValue,
        totalPnL,
        totalPnLPercent,
        positionCount: filtered.length,
        winnersCount,
        losersCount,
        winRate: filtered.length > 0 ? (winnersCount / filtered.length) * 100 : 0,
        bestPerformer,
        worstPerformer,
    };
}

interface PortfolioStore {
    // P&L History
    snapshots: PortfolioSnapshot[];
    addSnapshot: (snapshot: PortfolioSnapshot) => void;
    clearSnapshots: () => void;
    lastSnapshotDate: string | null;

    // Closed positions
    closedPositions: ClosedPosition[];
    closePosition: (position: ClosedPosition) => void;
    clearClosedPositions: () => void;

    // Actions
    calculateSummary: (watchlistItems: WatchlistItem[]) => PortfolioSummary;
    takeSnapshot: (watchlistItems: WatchlistItem[]) => void;
    getSnapshotsByRange: (days: number) => PortfolioSnapshot[];
}

export const usePortfolioStore = create<PortfolioStore>()(
    persist(
        (set, get) => ({
            snapshots: [],
            closedPositions: [],
            lastSnapshotDate: null,

            addSnapshot: (snapshot) =>
                set((state) => {
                    const updated = [...state.snapshots, snapshot];
                    // Keep max 365 snapshots
                    const trimmed = updated.length > 365 ? updated.slice(-365) : updated;
                    return { snapshots: trimmed, lastSnapshotDate: snapshot.date };
                }),

            clearSnapshots: () => set({ snapshots: [], lastSnapshotDate: null }),

            closePosition: (position) =>
                set((state) => ({
                    closedPositions: [...state.closedPositions, position],
                })),

            clearClosedPositions: () => set({ closedPositions: [] }),

            getSnapshotsByRange: (days) => {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - days);
                const cutoffStr = cutoff.toISOString().split('T')[0];
                return get().snapshots.filter((s) => s.date >= cutoffStr);
            },

            calculateSummary: (watchlistItems: WatchlistItem[]): PortfolioSummary => {
                const state = get();

                const usPnL = calculateMarketPnL(watchlistItems, 'US');
                const idPnL = calculateMarketPnL(watchlistItems, 'ID');

                const usClosedPnL = state.closedPositions
                    .filter((p) => p.market === 'US')
                    .reduce((sum, p) => sum + p.pnl, 0);

                const idClosedPnL = state.closedPositions
                    .filter((p) => p.market === 'ID')
                    .reduce((sum, p) => sum + p.pnl, 0);

                const totalPositions = watchlistItems.length;
                const totalWinners = usPnL.winnersCount + idPnL.winnersCount;
                const overallWinRate =
                    totalPositions > 0 ? (totalWinners / totalPositions) * 100 : 0;

                return {
                    us: usPnL,
                    id: idPnL,
                    totalPositions,
                    totalRealizedPnL: {
                        us: usClosedPnL,
                        id: idClosedPnL,
                    },
                    overallWinRate,
                };
            },

            takeSnapshot: (watchlistItems: WatchlistItem[]) => {
                const state = get();
                const today = new Date().toISOString().split('T')[0];

                if (state.lastSnapshotDate === today) return;
                if (watchlistItems.length === 0) return;

                const positions = watchlistItems.map((item) => {
                    const multiplier = item.market === 'ID' ? 100 : 1;
                    const invested = item.buyPrice * item.quantity * multiplier;
                    const currentValue = item.currentPrice * item.quantity * multiplier;
                    return {
                        symbol: item.symbol,
                        market: item.market,
                        buyPrice: item.buyPrice,
                        currentPrice: item.currentPrice,
                        quantity: item.quantity,
                        invested,
                        currentValue,
                        pnl: currentValue - invested,
                        pnlPercent: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
                    };
                });

                // Calculate per-market totals
                function marketSnapshot(market: Market): MarketSnapshotData {
                    const filtered = positions.filter((p) => p.market === market);
                    if (filtered.length === 0) return emptyMarketSnapshot();

                    const totalInvested = filtered.reduce((s, p) => s + p.invested, 0);
                    const totalCurrentValue = filtered.reduce((s, p) => s + p.currentValue, 0);
                    const totalPnL = totalCurrentValue - totalInvested;

                    return {
                        totalInvested,
                        totalCurrentValue,
                        totalPnL,
                        totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
                        positionCount: filtered.length,
                    };
                }

                const snapshot: PortfolioSnapshot = {
                    date: today,
                    timestamp: new Date().toISOString(),
                    us: marketSnapshot('US'),
                    id: marketSnapshot('ID'),
                    positions,
                };

                get().addSnapshot(snapshot);
            },
        }),
        {
            name: 'stock-portfolio',
        }
    )
);