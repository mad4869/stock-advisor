'use client';

import { useState } from 'react';
import { DividendInfo, AnnualCashFlow } from '@/types/analysis';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Calendar, History, TrendingUp, DollarSign } from 'lucide-react';

interface Props {
  dividend: DividendInfo;
  cashFlows: AnnualCashFlow[];
  currency: string;
}

export default function DividendAnalysis({ dividend, cashFlows, currency }: Props) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const hasDividend = (dividend.dividendYield != null && dividend.dividendYield > 0) || (dividend.payments && dividend.payments.length > 0);

  if (!hasDividend) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          Dividend Analysis
        </h3>
        <p className="text-xs text-gray-500">This company does not currently pay a dividend.</p>
      </div>
    );
  }

  const currSymbol = currency === 'IDR' ? 'Rp' : '$';

  // Build total dividends paid history from cashFlows (millions)
  const cashFlowDivHistory = cashFlows
    .filter((cf) => cf.dividendsPaid != null && cf.dividendsPaid > 0)
    .map((cf) => ({
      year: cf.year,
      Dividends: cf.dividendsPaid! / 1e6,
    }));

  // Build per-share yearly dividend chart from dividend payments if available
  const payments = dividend.payments || [];
  const yearlyPerShareMap: Record<string, number> = {};
  const yearlyCountMap: Record<string, number> = {};

  payments.forEach((p) => {
    const yr = p.date.slice(0, 4);
    yearlyPerShareMap[yr] = (yearlyPerShareMap[yr] || 0) + p.amount;
    yearlyCountMap[yr] = (yearlyCountMap[yr] || 0) + 1;
  });

  const yearlyPerShareData = Object.keys(yearlyPerShareMap)
    .sort()
    .map((year) => ({
      year,
      amount: Number(yearlyPerShareMap[year].toFixed(2)),
      count: yearlyCountMap[year],
    }));

  // Calculate dividend growth rate (CAGR)
  let divGrowthCAGR: number | null = null;
  if (yearlyPerShareData.length >= 2) {
    const first = yearlyPerShareData[0].amount;
    const last = yearlyPerShareData[yearlyPerShareData.length - 1].amount;
    const years = yearlyPerShareData.length - 1;
    if (first > 0 && years > 0) {
      divGrowthCAGR = (Math.pow(last / first, 1 / years) - 1) * 100;
    }
  } else if (cashFlowDivHistory.length >= 2) {
    const first = cashFlowDivHistory[0].Dividends;
    const last = cashFlowDivHistory[cashFlowDivHistory.length - 1].Dividends;
    const years = cashFlowDivHistory.length - 1;
    if (first > 0 && years > 0) {
      divGrowthCAGR = (Math.pow(last / first, 1 / years) - 1) * 100;
    }
  }

  // Format date helper
  const formatDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="card space-y-4">
      {/* Header with Title & Frequency Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          Dividend Analysis
        </h3>
        {dividend.dividendFrequencyLabel && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {dividend.dividendFrequencyLabel}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Dividend Yield</p>
          <p className="text-lg font-bold text-green-400">
            {dividend.dividendYield != null ? `${dividend.dividendYield.toFixed(2)}%` : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Annual Rate / Share</p>
          <p className="text-sm font-bold text-white">
            {dividend.dividendRate != null
              ? `${currSymbol} ${dividend.dividendRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Payout Ratio</p>
          <p className={`text-sm font-bold ${(dividend.payoutRatio ?? 0) > 90 ? 'text-red-400' : (dividend.payoutRatio ?? 0) > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
            {dividend.payoutRatio != null ? `${dividend.payoutRatio.toFixed(0)}%` : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Div Growth (CAGR)</p>
          <p className={`text-sm font-bold ${(divGrowthCAGR ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {divGrowthCAGR != null ? `${divGrowthCAGR >= 0 ? '+' : ''}${divGrowthCAGR.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Ex-Dividend & Payment Dates */}
      {(dividend.exDividendDate || dividend.dividendDate) && (
        <div className="flex flex-wrap gap-4 text-xs bg-dark-800/60 p-2.5 rounded-lg border border-dark-700/60">
          {dividend.exDividendDate && (
            <span className="text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Ex-Dividend: <span className="text-white font-medium">{formatDate(dividend.exDividendDate)}</span>
            </span>
          )}
          {dividend.dividendDate && (
            <span className="text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-green-400" />
              Payment Date: <span className="text-white font-medium">{formatDate(dividend.dividendDate)}</span>
            </span>
          )}
        </div>
      )}

      {/* Historical Dividend Section */}
      {payments.length > 0 && (
        <div className="space-y-3 pt-2">
          {/* Section Toggle */}
          <div className="flex items-center justify-between border-b border-dark-700 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-purple-400" />
              Payout History ({payments.length} Payments)
            </h4>
            <div className="flex gap-1 bg-dark-800 p-0.5 rounded-lg border border-dark-700">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600/20 text-blue-400 font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-blue-600/20 text-blue-400 font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Chart
              </button>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="space-y-2">
              {/* Yearly Summary Tags */}
              {yearlyPerShareData.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {yearlyPerShareData.slice(-4).reverse().map((y) => (
                    <span
                      key={y.year}
                      className="text-[11px] bg-dark-800 border border-dark-700 text-gray-300 px-2 py-0.5 rounded-md"
                    >
                      <strong className="text-white">{y.year}:</strong> {currSymbol} {y.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-gray-500">({y.count}×)</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Payments Table */}
              <div className="max-h-56 overflow-y-auto rounded-lg border border-dark-700 bg-dark-900/40">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-dark-800 text-gray-400 border-b border-dark-700 text-left">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Ex-Date</th>
                      <th className="py-2 px-3 font-semibold">Amount / Share</th>
                      <th className="py-2 px-3 font-semibold text-right">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/60">
                    {payments.map((p, idx) => (
                      <tr key={idx} className="hover:bg-dark-800/50 transition-colors">
                        <td className="py-2 px-3 text-white font-medium">
                          {formatDate(p.date)}
                        </td>
                        <td className="py-2 px-3 text-green-400 font-mono font-semibold">
                          {currSymbol} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-right">
                          {p.date.slice(0, 4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chart View */}
          {viewMode === 'chart' && (
            <div>
              <p className="text-[11px] text-gray-400 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                Annual Dividend Per Share ({currSymbol})
              </p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={yearlyPerShareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
                  <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${currSymbol} ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Annual Div / Share']}
                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Fallback Chart if no individual payment stream but cashFlow history exists */}
      {payments.length === 0 && cashFlowDivHistory.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Total Dividends Paid History (Millions)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={cashFlowDivHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #3a3a4d', borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="Dividends" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

