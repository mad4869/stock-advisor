import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    PortfolioSnapshot,
    ClosedPosition,
    WatchlistItem,
    PortfolioSummary,
} from '@/types';

interface PortfolioStore {
    // Cash balance tracking
    cashBalance: number;
    setCashBalance: (amount: number) => void;

    // P&L History (daily snapshots)
    snapshots: PortfolioSnapshot[];
    addSnapshot: (snapshot: PortfolioSnapshot) => void;
    getSnapshotsByRange: (days: number) => PortfolioSnapshot[];
    clearSnapshots: () => void;

    // Closed positions (realized P&L)
    closedPositions: ClosedPosition[];
    closePosition: (position: ClosedPosition) => void;
    clearClosedPositions: () => void;

    // Summary calculation
    calculateSummary: (watchlistItems: WatchlistItem[]) => PortfolioSummary;

    // Take a snapshot from current watchlist state
    takeSnapshot: (watchlistItems: WatchlistItem[]) => void;

    // Last snapshot date (prevent duplicates)
    lastSnapshotDate: string | null;
}

export const usePortfolioStore = create<PortfolioStore>()(
    persist(
        (set, get) => ({
            cashBalance: 0,
            snapshots: [],
            closedPositions: [],
            lastSnapshotDate: null,

            setCashBalance: (amount) => set({ cashBalance: amount }),

            addSnapshot: (snapshot) =>
                set((state) => {
                    // Keep max 365 days of snapshots
                    const updated = [...state.snapshots, snapshot];
                    if (updated.length > 365) {
                        return { snapshots: updated.slice(-365), lastSnapshotDate: snapshot.date };
                    }
                    return { snapshots: updated, lastSnapshotDate: snapshot.date };
                }),

            getSnapshotsByRange: (days) => {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - days);
                const cutoffStr = cutoff.toISOString().split('T')[0];
                return get().snapshots.filter((s) => s.date >= cutoffStr);
            },

            clearSnapshots: () => set({ snapshots: [], lastSnapshotDate: null }),

            closePosition: (position) =>
                set((state) => ({
                    closedPositions: [...state.closedPositions, position],
                    cashBalance: state.cashBalance + position.sellPrice * position.quantity * (position.market === 'ID' ? 100 : 1),
                })),

            clearClosedPositions: () => set({ closedPositions: [] }),

            calculateSummary: (watchlistItems: WatchlistItem[]): PortfolioSummary => {
                const state = get();

                if (watchlistItems.length === 0) {
                    return {
                        totalInvested: 0,
                        totalCurrentValue: 0,
                        totalPnL: 0,
                        totalPnLPercent: 0,
                        totalRealizedPnL: state.closedPositions.reduce((sum, p) => sum + p.pnl, 0),
                        bestPerformer: null,
                        worstPerformer: null,
                        winRate: 0,
                    };
                }

                let totalInvested = 0;
                let totalCurrentValue = 0;
                let bestPerformer: { symbol: string; pnlPercent: number } | null = null;
                let worstPerformer: { symbol: string; pnlPercent: number } | null = null;
                let winnersCount = 0;

                for (const item of watchlistItems) {
                    const multiplier = item.market === 'ID' ? 100 : 1; // lots vs shares
                    const invested = item.buyPrice * item.quantity * multiplier;
                    const currentValue = item.currentPrice * item.quantity * multiplier;
                    const pnlPercent = ((item.currentPrice - item.buyPrice) / item.buyPrice) * 100;

                    totalInvested += invested;
                    totalCurrentValue += currentValue;

                    if (pnlPercent >= 0) winnersCount++;

                    if (!bestPerformer || pnlPercent > bestPerformer.pnlPercent) {
                        bestPerformer = { symbol: item.symbol, pnlPercent };
                    }
                    if (!worstPerformer || pnlPercent < worstPerformer.pnlPercent) {
                        worstPerformer = { symbol: item.symbol, pnlPercent };
                    }
                }

                const totalPnL = totalCurrentValue - totalInvested;
                const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
                const totalRealizedPnL = state.closedPositions.reduce((sum, p) => sum + p.pnl, 0);
                const winRate =
                    watchlistItems.length > 0 ? (winnersCount / watchlistItems.length) * 100 : 0;

                return {
                    totalInvested,
                    totalCurrentValue,
                    totalPnL,
                    totalPnLPercent,
                    totalRealizedPnL,
                    bestPerformer,
                    worstPerformer,
                    winRate,
                };
            },

            takeSnapshot: (watchlistItems: WatchlistItem[]) => {
                const state = get();
                const today = new Date().toISOString().split('T')[0];

                // Only one snapshot per day
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

                const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);
                const totalCurrentValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
                const totalPnL = totalCurrentValue - totalInvested;

                const snapshot: PortfolioSnapshot = {
                    date: today,
                    timestamp: new Date().toISOString(),
                    totalInvested,
                    totalCurrentValue,
                    totalPnL,
                    totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
                    cashBalance: state.cashBalance,
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