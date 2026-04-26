import React from 'react';
import { FCFProjection } from '@/types/dcf';

interface Props {
  projections: FCFProjection[];
  currencySymbol: string;
}

export default function FCFProjectionTable({ projections, currencySymbol }: Props) {
  const formatCurrency = (val: number) => {
    if (val === 0) return '-';
    // Format large numbers with M/B suffixes for brevity
    if (Math.abs(val) >= 1e9) {
      return `${currencySymbol}${(val / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(val) >= 1e6) {
      return `${currencySymbol}${(val / 1e6).toFixed(2)}M`;
    }
    return `${currencySymbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-lg font-semibold text-white mb-4">10-Year Free Cash Flow Projections</h3>
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-400 bg-black/20 border-b border-white/5 uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 font-medium text-right">Projected FCF</th>
            <th className="px-4 py-3 font-medium text-right">Discount Factor</th>
            <th className="px-4 py-3 font-medium text-right text-blue-400">Present Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {projections.map((p) => (
            <tr key={p.year} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3 font-medium text-gray-300">
                {p.year} <span className="text-xs text-gray-500 ml-1">({p.label})</span>
              </td>
              <td className="px-4 py-3 text-right text-gray-300">
                {formatCurrency(p.fcf)}
              </td>
              <td className="px-4 py-3 text-right text-gray-400 font-mono text-xs">
                {p.discountFactor.toFixed(4)}
              </td>
              <td className="px-4 py-3 text-right text-blue-400 font-semibold">
                {formatCurrency(p.presentValue)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-white/10 bg-black/30">
          <tr>
            <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-400">
              Sum of PV of Projections:
            </td>
            <td className="px-4 py-3 text-right font-bold text-blue-400">
              {formatCurrency(projections.reduce((sum, p) => sum + p.presentValue, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
