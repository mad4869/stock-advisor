import { ScreenerPreset } from '@/types/screener';

export const SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: 'graham',
    name: 'Conservative Value',
    description: 'Benjamin Graham-style value investing — low P/E, low P/B, strong balance sheet, dividend-paying companies.',
    emoji: '🏛️',
    filters: {
      peRatio: { max: 15 },
      pbRatio: { max: 1.5 },
      currentRatio: { min: 2 },
      debtToEquity: { max: 0.5 },
      dividendYield: { min: 2 },
      earningsGrowth: { min: 0 },
    },
  },
  {
    id: 'garp',
    name: 'Growth at Reasonable Price',
    description: 'GARP strategy — strong growth companies that aren\'t overvalued. Balances growth metrics with valuation discipline.',
    emoji: '📈',
    filters: {
      pegRatio: { max: 1.5 },
      earningsGrowth: { min: 15 },
      roe: { min: 15 },
      revenueGrowth: { min: 10 },
      peRatio: { max: 25 },
    },
  },
  {
    id: 'deep-value',
    name: 'Deep Value',
    description: 'Contrarian deep value — extremely cheap stocks by multiple valuation metrics. Higher risk, potentially higher reward.',
    emoji: '💎',
    filters: {
      peRatio: { max: 8 },
      pbRatio: { max: 0.8 },
      evToEbitda: { max: 6 },
      freeCashFlow: { min: 0 },
      dividendYield: { min: 4 },
    },
  },
];
