'use client';

import { AnnualFinancials } from '@/types/analysis';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface Props {
  financials: AnnualFinancials[];
  currentROE: number | null;
  currentROA: number | null;
}

export default function ProfitabilityCharts({ financials, currentROE, currentROA }: Props) {
  if (financials.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-2">📊 Profitability</h3>
        <p className="text-xs text-gray-500">No historical data available.</p>
      </div>
    );
  }

  const marginData = financials.map((f) => ({
    year: f.year,
    'Gross Margin': f.grossMargin != null ? Math.round(f.grossMargin * 10) / 10 : null,
    'Operating Margin': f.operatingMargin != null ? Math.round(f.operatingMargin * 10) / 10 : null,
    'Net Margin': f.netMargin != null ? Math.round(f.netMargin * 10) / 10 : null,
  }));

  const lines = [
    { key: 'Gross Margin', color: '#22c55e' },
    { key: 'Operating Margin', color: '#3b82f6' },
    { key: 'Net Margin', color: '#a855f7' },
  ];

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-bold text-white">📊 Profitability</h3>

      {/* Current ROE/ROA badges */}
      <div className="flex gap-3">
        <div className="bg-dark-800 rounded-xl px-4 py-2 border border-dark-600 flex-1">
          <p className="text-[10px] text-gray-500">ROE (Current)</p>
          <p className={`text-lg font-bold ${(currentROE ?? 0) >= 15 ? 'text-green-400' : (currentROE ?? 0) >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
            {currentROE != null ? `${currentROE.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl px-4 py-2 border border-dark-600 flex-1">
          <p className="text-[10px] text-gray-500">ROA (Current)</p>
          <p className={`text-lg font-bold ${(currentROA ?? 0) >= 10 ? 'text-green-400' : (currentROA ?? 0) >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
            {currentROA != null ? `${currentROA.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Margins Chart */}
      {marginData.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Margin Trends</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 12, fontSize: 12 }}
                formatter={(value: number) => [`${value}%`]}
              />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ fill: line.color, r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {lines.map((l) => (
              <span key={l.key} className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.key}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
