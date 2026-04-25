'use client';

import { AnnualBalanceSheet, ComprehensiveAnalysis } from '@/types/analysis';

interface Props {
  analysis: ComprehensiveAnalysis;
}

// Custom SVG gauge component
function GaugeChart({
  value,
  max,
  label,
  suffix,
  thresholds,
}: {
  value: number | null;
  max: number;
  label: string;
  suffix: string;
  thresholds: { good: number; warning: number };
}) {
  if (value == null) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 text-center">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-lg font-bold text-gray-600">—</p>
      </div>
    );
  }

  const clampedValue = Math.min(Math.max(value, 0), max);
  const percentage = (clampedValue / max) * 100;
  const angle = (percentage / 100) * 180; // 0-180 degrees for semi-circle

  let color = '#22c55e'; // green
  if (label.includes('Debt') || label.includes('D/E')) {
    // For debt ratios, lower is better
    if (value > thresholds.warning) color = '#ef4444'; // red
    else if (value > thresholds.good) color = '#eab308'; // yellow
  } else {
    // For liquidity ratios, higher is better
    if (value < thresholds.warning) color = '#ef4444';
    else if (value < thresholds.good) color = '#eab308';
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 text-center">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="relative mx-auto w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke="#2a2a3d"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 157} 157`}
            className="transition-all duration-700"
          />
        </svg>
      </div>
      <p className="text-xl font-bold text-white -mt-1">
        {value.toFixed(2)}{suffix}
      </p>
    </div>
  );
}

function fmtB(value: number | null): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
  return value.toLocaleString();
}

export default function FinancialHealth({ analysis }: Props) {
  const { fundamentals, balanceSheets, interestCoverage, debtToEbitda } = analysis;
  const latest = balanceSheets[balanceSheets.length - 1];

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-bold text-white">🏦 Financial Health</h3>

      {/* Gauge Charts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GaugeChart
          value={fundamentals.debtToEquity}
          max={3}
          label="Debt/Equity"
          suffix="x"
          thresholds={{ good: 0.5, warning: 1.5 }}
        />
        <GaugeChart
          value={fundamentals.currentRatio}
          max={5}
          label="Current Ratio"
          suffix="x"
          thresholds={{ good: 2.0, warning: 1.0 }}
        />
        <GaugeChart
          value={latest?.quickRatio ?? null}
          max={5}
          label="Quick Ratio"
          suffix="x"
          thresholds={{ good: 1.5, warning: 0.8 }}
        />
        <GaugeChart
          value={interestCoverage}
          max={20}
          label="Interest Coverage"
          suffix="x"
          thresholds={{ good: 5, warning: 2 }}
        />
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Debt/EBITDA</p>
          <p className="text-sm font-bold text-white">
            {debtToEbitda != null ? `${debtToEbitda.toFixed(1)}x` : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Total Debt</p>
          <p className="text-sm font-bold text-white">{fmtB(latest?.totalDebt ?? null)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Cash & Equiv.</p>
          <p className="text-sm font-bold text-white">{fmtB(latest?.cash ?? null)}</p>
        </div>
      </div>

      {/* Debt Composition */}
      {latest && (latest.shortTermDebt != null || latest.longTermDebt != null) && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Debt Composition</p>
          <div className="flex items-center gap-2">
            {(() => {
              const st = latest.shortTermDebt || 0;
              const lt = latest.longTermDebt || 0;
              const total = st + lt;
              if (total === 0) return <p className="text-xs text-gray-600">No debt data</p>;
              const stPct = (st / total) * 100;
              const ltPct = (lt / total) * 100;

              return (
                <>
                  <div className="flex-1 h-4 bg-dark-600 rounded-full overflow-hidden flex">
                    <div
                      className="bg-orange-500 h-full transition-all"
                      style={{ width: `${stPct}%` }}
                      title={`Short-term: ${fmtB(st)}`}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${ltPct}%` }}
                      title={`Long-term: ${fmtB(lt)}`}
                    />
                  </div>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-orange-400">ST: {fmtB(st)} ({stPct.toFixed(0)}%)</span>
                    <span className="text-blue-400">LT: {fmtB(lt)} ({ltPct.toFixed(0)}%)</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
