'use client';

import { AnnualCashFlow, ComprehensiveAnalysis } from '@/types/analysis';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface Props {
  analysis: ComprehensiveAnalysis;
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

export default function CashFlowAnalysis({ analysis }: Props) {
  const { cashFlows, fcfMargin, fcfYield } = analysis;

  if (cashFlows.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-2">💸 Cash Flow Analysis</h3>
        <p className="text-xs text-gray-500">No cash flow data available.</p>
      </div>
    );
  }

  const chartData = cashFlows.map((cf) => ({
    year: cf.year,
    'Operating CF': cf.operatingCashFlow ? cf.operatingCashFlow / 1e6 : null,
    'CapEx': cf.capitalExpenditure ? -(cf.capitalExpenditure / 1e6) : null,
    'Free CF': cf.freeCashFlow ? cf.freeCashFlow / 1e6 : null,
  }));

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-bold text-white">💸 Cash Flow Analysis</h3>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">FCF Margin</p>
          <p className={`text-sm font-bold ${(fcfMargin ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fcfMargin != null ? `${fcfMargin.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">FCF Yield</p>
          <p className={`text-sm font-bold ${(fcfYield ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fcfYield != null ? `${fcfYield.toFixed(1)}%` : '—'}
          </p>
        </div>
        {cashFlows.length > 0 && (
          <>
            <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
              <p className="text-[10px] text-gray-500">Latest OCF</p>
              <p className="text-sm font-bold text-white">
                {fmtB(cashFlows[cashFlows.length - 1].operatingCashFlow)}
              </p>
            </div>
            <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
              <p className="text-[10px] text-gray-500">Latest FCF</p>
              <p className={`text-sm font-bold ${(cashFlows[cashFlows.length - 1].freeCashFlow ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtB(cashFlows[cashFlows.length - 1].freeCashFlow)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Cash Flow Trend (M)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtB(v * 1e6)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 12, fontSize: 12 }}
                formatter={(value: number, name: string) => [fmtB(value * 1e6), name]}
              />
              <Bar dataKey="Operating CF" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CapEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Free CF" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Operating CF
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> CapEx
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Free CF
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
