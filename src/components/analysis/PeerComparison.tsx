'use client';

import { PeerData } from '@/types/analysis';

interface Props {
  peers: PeerData[];
  currentSymbol: string;
  currentData: PeerData;
}

function fmtNum(value: number | null, decimals = 1, suffix = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}${suffix}`;
}

function fmtLarge(value: number | null): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toLocaleString();
}

type ColKey = Exclude<keyof PeerData, 'symbol' | 'name'>;

interface Column {
  key: ColKey;
  label: string;
  format: (v: number | null) => string;
  goodDirection: 'lower' | 'higher';
}

const COLUMNS: Column[] = [
  { key: 'peRatio', label: 'P/E', format: (v) => fmtNum(v, 1, 'x'), goodDirection: 'lower' },
  { key: 'pbRatio', label: 'P/B', format: (v) => fmtNum(v, 1, 'x'), goodDirection: 'lower' },
  { key: 'roe', label: 'ROE', format: (v) => fmtNum(v, 1, '%'), goodDirection: 'higher' },
  { key: 'netProfitMargin', label: 'Net Margin', format: (v) => fmtNum(v, 1, '%'), goodDirection: 'higher' },
  { key: 'revenueGrowth', label: 'Rev Growth', format: (v) => fmtNum(v, 1, '%'), goodDirection: 'higher' },
  { key: 'debtToEquity', label: 'D/E', format: (v) => fmtNum(v, 2, 'x'), goodDirection: 'lower' },
  { key: 'dividendYield', label: 'Div Yield', format: (v) => fmtNum(v, 2, '%'), goodDirection: 'higher' },
  { key: 'marketCap', label: 'Mkt Cap', format: fmtLarge, goodDirection: 'higher' },
];

function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getCellClass(
  value: number | null,
  median: number,
  goodDirection: 'lower' | 'higher',
  isCurrentStock: boolean
): string {
  if (value == null) return 'text-gray-600';
  if (isCurrentStock) return 'text-white font-bold';

  const isBetter =
    goodDirection === 'lower' ? value < median : value > median;
  return isBetter ? 'text-green-400' : 'text-red-400';
}

export default function PeerComparison({ peers, currentSymbol, currentData }: Props) {
  if (peers.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-2">🔍 Peer Comparison</h3>
        <p className="text-xs text-gray-500">
          No peers found in the same sector for comparison.
        </p>
      </div>
    );
  }

  // All rows: current stock + peers
  const allRows = [currentData, ...peers];

  // Compute medians per column (excluding current stock for fair comparison)
  const medians: Partial<Record<ColKey, number>> = {};
  for (const col of COLUMNS) {
    const peerVals = peers
      .map((p) => p[col.key])
      .filter((v): v is number => v != null);
    if (peerVals.length > 0) medians[col.key] = getMedian(peerVals);
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-dark-600">
        <h3 className="text-sm font-bold text-white">
          🔍 Peer Comparison
          <span className="ml-2 text-xs font-normal text-gray-500">
            {peers.length} peers • Green = better than median, Red = worse
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-gray-500 bg-dark-800 border-b border-dark-600">
              <th className="text-left py-3 px-4 sticky left-0 bg-dark-800 z-10 min-w-[140px]">
                Company
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="text-right py-3 px-3 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row) => {
              const isCurrent = row.symbol === currentSymbol;
              return (
                <tr
                  key={row.symbol}
                  className={`border-b border-dark-700 transition-colors ${
                    isCurrent
                      ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                      : 'hover:bg-dark-800'
                  }`}
                >
                  <td className={`py-3 px-4 sticky left-0 z-10 ${
                    isCurrent ? 'bg-blue-600/10' : 'bg-dark-700'
                  }`}>
                    <div>
                      <span className={`font-bold text-xs ${isCurrent ? 'text-blue-400' : 'text-white'}`}>
                        {row.symbol}
                        {isCurrent && (
                          <span className="ml-1.5 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </span>
                      <p className="text-[10px] text-gray-500 truncate max-w-[120px]">
                        {row.name}
                      </p>
                    </div>
                  </td>
                  {COLUMNS.map((col) => {
                    const value = row[col.key];
                    const median = medians[col.key] ?? 0;
                    return (
                      <td
                        key={col.key}
                        className={`py-3 px-3 text-right text-xs whitespace-nowrap ${getCellClass(
                          value,
                          median,
                          col.goodDirection,
                          isCurrent
                        )}`}
                      >
                        {col.format(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Median row */}
            <tr className="border-t border-dark-500 bg-dark-800">
              <td className="py-2 px-4 sticky left-0 bg-dark-800 z-10">
                <span className="text-[10px] text-gray-500 italic">Peer Median</span>
              </td>
              {COLUMNS.map((col) => (
                <td key={col.key} className="py-2 px-3 text-right text-[10px] text-gray-500 whitespace-nowrap">
                  {medians[col.key] != null ? col.format(medians[col.key]!) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
