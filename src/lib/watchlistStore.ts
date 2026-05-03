import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WatchlistItem, Market } from '@/types';

interface WatchlistStore {
  items: WatchlistItem[];
  addItem: (
    item: Omit<
      WatchlistItem,
      'id' | 'currentPrice' | 'pnl' | 'pnlPercent' | 'action' | 'actionReason' | 'lastUpdated'
    >
  ) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<WatchlistItem>) => void;
  clearAll: () => void;
}

export const CURRENT_SCHEMA_VERSION = 2;

export const migrateWatchlistState = (persistedState: any, version: number) => {
  if (version < 2) {
    const state = persistedState as any;
    if (state.items) {
      state.items = state.items.map((item: any) => ({
        ...item,
        fcdstScore: item.fcdstScore ?? null,
        thesis: item.thesis ?? null,
      }));
    }
    return state;
  }
  return persistedState as any;
};

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              ...item,
              id: `${item.symbol}-${Date.now()}`,
              currentPrice: item.buyPrice,
              pnl: 0,
              pnlPercent: 0,
              action: 'HOLD',
              actionReason: 'Just added to watchlist. Monitoring...',
              lastUpdated: new Date().toISOString(),
            },
          ],
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'stock-watchlist',
      version: CURRENT_SCHEMA_VERSION,
      migrate: migrateWatchlistState,
    }
  )
);