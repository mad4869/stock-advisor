'use client';

import { DividendInfo, AnnualCashFlow } from '@/types/analysis';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface Props {
  dividend: DividendInfo;
  cashFlows: AnnualCashFlow[];
  currency: string;
}

export default function DividendAnalysis({ dividend, cashFlows, currency }: Props) {
  const hasDividend = dividend.dividendYield != null && dividend.dividendYield > 0;

  if (!hasDividend) {
    return (
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-2">💵 Dividend Analysis</h3>
        <p className="text-xs text-gray-500">This company does not currently pay a dividend.</p>
      </div>
    );
  }

  // Build dividend history from cashFlows
  const divHistory = cashFlows
    .filter((cf) => cf.dividendsPaid != null && cf.dividendsPaid > 0)
    .map((cf) => ({
      year: cf.year,
      Dividends: cf.dividendsPaid! / 1e6,
    }));

  // Calculate dividend growth rate (CAGR)
  let divGrowthCAGR: number | null = null;
  if (divHistory.length >= 2) {
    const first = divHistory[0].Dividends;
    const last = divHistory[divHistory.length - 1].Dividends;
    const years = divHistory.length - 1;
    if (first > 0 && years > 0) {
      divGrowthCAGR = (Math.pow(last / first, 1 / years) - 1) * 100;
    }
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-bold text-white">💵 Dividend Analysis</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Dividend Yield</p>
          <p className="text-lg font-bold text-green-400">
            {dividend.dividendYield?.toFixed(2)}%
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500">Annual Rate</p>
          <p className="text-sm font-bold text-white">
            {dividend.dividendRate != null
              ? `${currency === 'IDR' ? 'Rp' : '$'}${dividend.dividendRate.toFixed(2)}`
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
            {divGrowthCAGR != null ? `${divGrowthCAGR.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Dates */}
      <div className="flex gap-4 text-xs">
        {dividend.exDividendDate && (
          <span className="text-gray-400">
            Ex-Dividend: <span className="text-white">{dividend.exDividendDate}</span>
          </span>
        )}
        {dividend.dividendDate && (
          <span className="text-gray-400">
            Payment: <span className="text-white">{dividend.dividendDate}</span>
          </span>
        )}
      </div>

      {/* Dividends Paid Chart */}
      {divHistory.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Dividends Paid History (M)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={divHistory}>
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
