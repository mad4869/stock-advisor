'use client';

import { AnnualFinancials, AnnualCashFlow } from '@/types/analysis';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface Props {
  financials: AnnualFinancials[];
  cashFlows: AnnualCashFlow[];
  cagr: {
    revenue3Y: number | null;
    revenue5Y: number | null;
    eps3Y: number | null;
    eps5Y: number | null;
  };
}

function fmtB(value: number | null): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
  return `${sign}${abs.toLocaleString()}`;
}

export default function GrowthCharts({ financials, cashFlows, cagr }: Props) {
  if (financials.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-2">🚀 Growth</h3>
        <p className="text-xs text-gray-500">No historical data available.</p>
      </div>
    );
  }

  const revenueData = financials.map((f, i) => {
    const prevRev = i > 0 ? financials[i - 1].totalRevenue : null;
    const yoyGrowth = f.totalRevenue && prevRev && prevRev > 0
      ? ((f.totalRevenue - prevRev) / prevRev) * 100
      : null;
    return {
      year: f.year,
      Revenue: f.totalRevenue ? f.totalRevenue / 1e6 : null,
      'Net Income': f.netIncome ? f.netIncome / 1e6 : null,
      yoyGrowth,
    };
  });

  const epsData = financials.map((f) => ({
    year: f.year,
    EPS: f.eps,
  }));

  const fcfData = cashFlows.map((cf) => ({
    year: cf.year,
    FCF: cf.freeCashFlow ? cf.freeCashFlow / 1e6 : null,
  }));

  return (
    <div className="card space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">🚀 Growth</h3>
        <div className="flex gap-2">
          {cagr.revenue3Y != null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cagr.revenue3Y >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              Rev CAGR 3Y: {cagr.revenue3Y.toFixed(1)}%
            </span>
          )}
          {cagr.eps3Y != null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cagr.eps3Y >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              EPS CAGR 3Y: {cagr.eps3Y.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Revenue + Net Income */}
      {revenueData.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Revenue & Net Income (M)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtB(v * 1e6)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 12, fontSize: 12 }}
                formatter={(value: number, name: string) => [fmtB(value * 1e6), name]}
              />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Revenue
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Net Income
            </span>
          </div>
        </div>
      )}

      {/* EPS Trend */}
      {epsData.some((d) => d.EPS != null) && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Earnings Per Share (EPS)</p>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={epsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 12, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="EPS" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* FCF Trend */}
      {fcfData.some((d) => d.FCF != null) && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Free Cash Flow (M)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={fcfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtB(v * 1e6)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 12, fontSize: 12 }}
                formatter={(value: number) => [fmtB(value * 1e6), 'FCF']}
              />
              <Bar dataKey="FCF" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
