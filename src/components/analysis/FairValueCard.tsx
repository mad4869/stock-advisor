'use client';

import { FairValueResult } from '@/lib/valuationCalculator';
import { Market } from '@/types';

interface Props {
  fairValue: FairValueResult;
  market: Market;
}

export default function FairValueCard({ fairValue, market }: Props) {
  const currencySymbol = market === 'ID' ? 'Rp ' : '$';
  const { currentPrice, blendedFairPrice, marginOfSafety, status, methods } = fairValue;

  const fmt = (val: number | null) => {
    if (val == null) return '—';
    if (market === 'ID') {
      return `${currencySymbol}${Math.round(val).toLocaleString('id-ID')}`;
    }
    return `${currencySymbol}${val.toFixed(2)}`;
  };

  const statusConfig = {
    undervalued: {
      label: 'UNDERVALUED',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      badge: 'bg-green-500 text-white',
      icon: '🟢',
    },
    fair: {
      label: 'FAIR VALUE',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      badge: 'bg-yellow-500 text-black',
      icon: '🟡',
    },
    overvalued: {
      label: 'OVERVALUED',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      badge: 'bg-red-500 text-white',
      icon: '🔴',
    },
    unknown: {
      label: 'N/A',
      bg: 'bg-gray-800',
      border: 'border-gray-700',
      text: 'text-gray-400',
      badge: 'bg-gray-700 text-gray-300',
      icon: '⚪',
    },
  }[status];

  return (
    <div className="card space-y-4 border border-dark-600 bg-dark-800/80 p-4 rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-700 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            🏷️ Fair Value & Normal Price Estimate
          </h3>
          <p className="text-[11px] text-gray-400">
            Blended relative valuation combining PER, PBV, and Graham Number models
          </p>
        </div>
        {marginOfSafety != null && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusConfig.badge}`}>
              {statusConfig.icon} {statusConfig.label}
            </span>
          </div>
        )}
      </div>

      {/* Main Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-dark-900/60 p-3 rounded-lg border border-dark-700">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Live Price</span>
          <span className="text-xl font-bold text-white">{fmt(currentPrice)}</span>
        </div>
        <div className={`p-3 rounded-lg border ${statusConfig.border} ${statusConfig.bg}`}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Normal Price (Blended)</span>
            {marginOfSafety != null && (
              <span className={`text-xs font-bold ${statusConfig.text}`}>
                {marginOfSafety >= 0 ? `+${marginOfSafety.toFixed(1)}% MOS` : `${marginOfSafety.toFixed(1)}% MOS`}
              </span>
            )}
          </div>
          <span className={`text-xl font-bold ${statusConfig.text}`}>
            {fmt(blendedFairPrice)}
          </span>
        </div>
      </div>

      {/* Methods Breakdown */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
          Valuation Breakdown by Method
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {Object.values(methods).map((m) => (
            <div
              key={m.name}
              className="bg-dark-900/40 border border-dark-700/80 p-2.5 rounded-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-gray-200">{m.name}</span>
                  <span className="text-[9px] text-gray-400 bg-dark-800 px-1.5 py-0.5 rounded">
                    {m.targetMultiple}x
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mb-2 leading-tight">{m.description}</p>
              </div>
              <div className="pt-1 border-t border-dark-800 flex items-center justify-between">
                <span className="text-[10px] text-gray-500">Fair Price</span>
                <span className={`text-xs font-bold ${m.isAvailable ? 'text-white' : 'text-gray-500'}`}>
                  {fmt(m.fairPrice)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
