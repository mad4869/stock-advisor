'use client';

import { FundamentalData } from '@/types/screener';
import { Market } from '@/types';
import { US_THRESHOLDS, IDX_THRESHOLDS, ThresholdLevel, ValuationThresholds } from '@/types/analysis';

interface Props {
  fundamentals: FundamentalData;
  analystRating: {
    buy: number;
    hold: number;
    sell: number;
    targetMeanPrice: number | null;
  };
}

interface MetricCard {
  label: string;
  value: number | null;
  suffix: string;
  thresholdKey: keyof ValuationThresholds | null;
  description: string;
}

function getLevel(
  value: number | null,
  key: keyof ValuationThresholds | null,
  thresholds: ValuationThresholds
): ThresholdLevel {
  if (value == null || key == null) return 'fair';
  const t = thresholds[key];
  if (value <= t.good) return 'good';
  if (value <= t.fair) return 'fair';
  return 'expensive';
}

const levelColors: Record<ThresholdLevel, { bg: string; border: string; text: string; badge: string }> = {
  good: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    badge: 'Undervalued',
  },
  fair: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'Fair Value',
  },
  expensive: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'Expensive',
  },
};

export default function ValuationMetrics({ fundamentals, analystRating }: Props) {
  const thresholds = fundamentals.market === 'ID' ? IDX_THRESHOLDS : US_THRESHOLDS;

  const metrics: MetricCard[] = [
    { label: 'P/E Ratio (TTM)', value: fundamentals.peRatio, suffix: 'x', thresholdKey: 'peRatio', description: 'Price relative to earnings' },
    { label: 'Forward P/E', value: fundamentals.forwardPE, suffix: 'x', thresholdKey: 'peRatio', description: 'Based on estimated future earnings' },
    { label: 'P/B Ratio', value: fundamentals.pbRatio, suffix: 'x', thresholdKey: 'pbRatio', description: 'Price relative to book value' },
    { label: 'PEG Ratio', value: fundamentals.pegRatio, suffix: 'x', thresholdKey: 'pegRatio', description: 'P/E adjusted for growth' },
    { label: 'EV/EBITDA', value: fundamentals.evToEbitda, suffix: 'x', thresholdKey: 'evToEbitda', description: 'Enterprise value to EBITDA' },
    { label: 'P/S Ratio', value: fundamentals.psRatio, suffix: 'x', thresholdKey: null, description: 'Price relative to sales' },
  ];

  const totalAnalysts = analystRating.buy + analystRating.hold + analystRating.sell;

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        💰 Valuation Metrics
        <span className="text-[10px] text-gray-500 font-normal">
          ({fundamentals.market === 'ID' ? 'IDX' : 'US'} thresholds)
        </span>
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((metric) => {
          const level = getLevel(metric.value, metric.thresholdKey, thresholds);
          const colors = levelColors[level];

          return (
            <div
              key={metric.label}
              className={`${colors.bg} border ${colors.border} rounded-xl p-3 transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-400">{metric.label}</span>
                {metric.thresholdKey && (
                  <span className={`text-[9px] ${colors.text} font-medium px-1.5 py-0.5 rounded-full bg-dark-900/50`}>
                    {colors.badge}
                  </span>
                )}
              </div>
              <p className={`text-lg font-bold ${colors.text}`}>
                {metric.value != null ? `${metric.value.toFixed(1)}${metric.suffix}` : '—'}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">{metric.description}</p>
            </div>
          );
        })}
      </div>

      {/* Analyst Consensus */}
      {totalAnalysts > 0 && (
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
          <p className="text-xs text-gray-500 mb-2">Analyst Consensus ({totalAnalysts} analysts)</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-3 bg-dark-600 rounded-full overflow-hidden flex">
              <div
                className="bg-green-500 h-full"
                style={{ width: `${(analystRating.buy / totalAnalysts) * 100}%` }}
              />
              <div
                className="bg-yellow-500 h-full"
                style={{ width: `${(analystRating.hold / totalAnalysts) * 100}%` }}
              />
              <div
                className="bg-red-500 h-full"
                style={{ width: `${(analystRating.sell / totalAnalysts) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-green-400">Buy: {analystRating.buy}</span>
            <span className="text-yellow-400">Hold: {analystRating.hold}</span>
            <span className="text-red-400">Sell: {analystRating.sell}</span>
          </div>
          {analystRating.targetMeanPrice && (
            <p className="text-xs text-gray-400 mt-2">
              Target Price: <span className="text-white font-medium">${analystRating.targetMeanPrice.toFixed(2)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
