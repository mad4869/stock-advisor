import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BankingMetrics {
  symbol: string;
  npl: number; // 0-100
  car: number; // 0-100
  sourceNote: string;
  lastUpdated: number; // timestamp
}

interface BankingMetricsState {
  metrics: Record<string, BankingMetrics>;
  saveMetrics: (symbol: string, metrics: Omit<BankingMetrics, 'symbol' | 'lastUpdated'>) => void;
  getMetrics: (symbol: string) => BankingMetrics | undefined;
}

export const useBankingMetricsStore = create<BankingMetricsState>()(
  persist(
    (set, get) => ({
      metrics: {},
      saveMetrics: (symbol, data) => {
        set((state) => ({
          metrics: {
            ...state.metrics,
            [symbol]: {
              ...data,
              symbol,
              lastUpdated: Date.now(),
            },
          },
        }));
      },
      getMetrics: (symbol) => {
        return get().metrics[symbol];
      },
    }),
    {
      name: 'banking-metrics-storage',
      version: 2,
    }
  )
);
