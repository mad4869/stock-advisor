'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, ChevronRight, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Market, SwingScreenerResult } from '@/types';

interface StableScreenerProps {
  mode: 'DEFENSIVE' | 'HIGH_YIELD_DIVIDEND';
}

function GradeBadge({ grade, total }: { grade: string; total: number }) {
  const color =
    grade === 'A' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
    grade === 'B' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
    grade === 'C' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
    grade === 'D' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20';
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-bold border ${color}`} title={`Score: ${total}/100`}>
      {grade} ({total})
    </span>
  );
}

export default function StableScreener({ mode }: StableScreenerProps) {
  const router = useRouter();
  const [marketTab, setMarketTab] = useState<Market>('US');
  const [usUniverse, setUsUniverse] = useState('SP100');
  const [idUniverse, setIdUniverse] = useState('LQ45');
  const [results, setResults] = useState<SwingScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const universe = marketTab === 'US' ? usUniverse : idUniverse;

  const fetchResults = useCallback(async (mkt: Market, univ: string) => {
    setLoading(true);
    setError('');
    setResults([]);
    const allResults: SwingScreenerResult[] = [];
    let currentPage = 1;
    try {
      while (true) {
        const res = await fetch(
          `/api/screener?market=${mkt}&universe=${univ}&preset=${mode}&page=${currentPage}&limit=15`
        );
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        if (data.results) allResults.push(...data.results);
        if (currentPage >= data.pagination.totalPages) break;
        currentPage++;
      }
      // Re-sort the full accumulated list (API only sorts per-page chunk)
      if (mode === 'HIGH_YIELD_DIVIDEND') {
        allResults.sort((a, b) => {
          const aY = a.dividendYield ?? 0;
          const bY = b.dividendYield ?? 0;
          if (bY !== aY) return bY - aY;
          const aF = a.fundamentalScore?.total ?? 0;
          const bF = b.fundamentalScore?.total ?? 0;
          if (bF !== aF) return bF - aF;
          return (b.priceDiscountFromPeak ?? 0) - (a.priceDiscountFromPeak ?? 0);
        });
      } else {
        allResults.sort((a, b) => {
          const aBeta = (a.beta != null && a.beta > 0) ? a.beta : 1.0;
          const bBeta = (b.beta != null && b.beta > 0) ? b.beta : 1.0;
          if (aBeta !== bBeta) return aBeta - bBeta;
          const aY = a.dividendYield ?? 0;
          const bY = b.dividendYield ?? 0;
          if (bY !== aY) return bY - aY;
          return (b.fundamentalScore?.total ?? 0) - (a.fundamentalScore?.total ?? 0);
        });
      }
      setResults(allResults);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchResults('US', 'SP100');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarketChange = (mkt: Market) => {
    setMarketTab(mkt);
    const univ = mkt === 'US' ? usUniverse : idUniverse;
    fetchResults(mkt, univ);
  };

  const handleUniverseChange = (univ: string) => {
    if (marketTab === 'US') setUsUniverse(univ);
    else setIdUniverse(univ);
    fetchResults(marketTab, univ);
  };

  const isDefensive = mode === 'DEFENSIVE';
  const colSpan = 8;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-dark-800 p-4 rounded-xl border border-dark-600">
        <div className="flex gap-3">
          {(['US', 'ID'] as Market[]).map((m) => (
            <button
              key={m}
              onClick={() => handleMarketChange(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                marketTab === m
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {m === 'US' ? '🇺🇸 US' : '🇮🇩 IDX'}
            </button>
          ))}
        </div>

        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Universe</label>
          {marketTab === 'US' ? (
            <select value={usUniverse} onChange={(e) => handleUniverseChange(e.target.value)} className="input-field py-2">
              <option value="SP100">S&P 100</option>
              <option value="SP500">S&P 500</option>
              <option value="NASDAQ100">NASDAQ 100</option>
            </select>
          ) : (
            <select value={idUniverse} onChange={(e) => handleUniverseChange(e.target.value)} className="input-field py-2">
              <option value="LQ45">LQ45</option>
              <option value="KOMPAS100">Kompas 100</option>
              <option value="ALL">All IDX (~900)</option>
            </select>
          )}
        </div>

        <button
          onClick={() => fetchResults(marketTab, universe)}
          disabled={loading}
          className="btn-secondary py-2 px-4 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      <div className={`text-xs rounded-xl p-3 border flex flex-wrap gap-x-4 gap-y-1 ${
        isDefensive
          ? 'bg-blue-500/5 border-blue-500/20 text-blue-300/70'
          : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300/70'
      }`}>
        {isDefensive ? (
          <>
            <span>🛡️ <strong>Hard gates:</strong> Beta 0.1–0.8 · Div yield ≥1.5% (US) / 2.5% (IDX)</span>
            <span>📊 <strong>3 of 5:</strong> ATR% &lt;2.5% · Above EMA200 · D/E ≤1.2× · CR ≥1.3× · ROE ≥8%</span>
            <span>📈 <strong>Sorted by:</strong> lowest beta → highest yield → best fundamentals</span>
          </>
        ) : (
          <>
            <span>💰 <strong>Hard gate:</strong> Dividend yield ≥5%</span>
            <span>📊 <strong>Quality gate:</strong> Fundamental grade A, B, or C</span>
            <span>📈 <strong>Sorted by:</strong> highest yield → best fundamentals → most discounted from peak</span>
          </>
        )}
      </div>

      <div>
        {results.length > 0 && !loading && (
          <p className="text-sm text-gray-400 mb-3">
            <span className="text-white font-bold">{results.length}</span> stocks passed
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-dark-600">
                <th className="py-3 px-4 font-semibold">Symbol</th>
                {isDefensive ? (
                  <>
                    <th className="py-3 px-4 font-semibold">Beta</th>
                    <th className="py-3 px-4 font-semibold">Div Yield</th>
                    <th className="py-3 px-4 font-semibold">Quality</th>
                    <th className="py-3 px-4 font-semibold">ATR%</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-4 font-semibold">Div Yield</th>
                    <th className="py-3 px-4 font-semibold">Frequency</th>
                    <th className="py-3 px-4 font-semibold">Quality</th>
                    <th className="py-3 px-4 font-semibold">Discount from Peak</th>
                  </>
                )}
                <th className="py-3 px-4 font-semibold">TA Score</th>
                <th className="py-3 px-4 font-semibold">Why Passed</th>
                <th className="py-3 px-4 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Scanning {universe} for {isDefensive ? 'defensive' : 'high-dividend'} stocks…
                  </td>
                </tr>
              )}
              {!loading && results.length === 0 && !error && (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-gray-500">
                    <Info className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                    No stocks passed the screening criteria.
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={colSpan} className="py-4 text-center text-red-400">{error}</td>
                </tr>
              )}

              {results.map((result) => {
                const isExpanded = expandedSymbol === result.symbol;
                const atrPct = result.taData?.atrPercent as number | null | undefined;
                const sym = result.symbol.replace('.JK', '');

                return (
                  <React.Fragment key={result.symbol}>
                    <tr
                      className="border-b border-dark-700 hover:bg-dark-800 cursor-pointer transition-colors group"
                      onClick={() => setExpandedSymbol(isExpanded ? null : result.symbol)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{sym}</div>
                        <div className="text-xs text-gray-500">{result.sector ?? (marketTab === 'US' ? '🇺🇸' : '🇮🇩')}</div>
                      </td>

                      {isDefensive ? (
                        <>
                          <td className="py-3 px-4">
                            {result.beta != null ? (
                              <span className={`font-mono font-semibold ${result.beta < 0.5 ? 'text-green-400' : result.beta < 0.8 ? 'text-blue-400' : 'text-yellow-400'}`}>
                                {result.beta.toFixed(2)}
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {result.dividendYield != null && result.dividendYield > 0
                              ? <span className="text-green-400 font-semibold">{result.dividendYield.toFixed(2)}%</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {result.fundamentalScore
                              ? <GradeBadge grade={result.fundamentalScore.grade} total={result.fundamentalScore.total} />
                              : <span className="text-xs text-gray-500">N/A</span>}
                          </td>
                          <td className="py-3 px-4">
                            {atrPct != null
                              ? <span className={atrPct < 1.5 ? 'text-green-400' : atrPct < 2.5 ? 'text-yellow-400' : 'text-red-400'}>{atrPct.toFixed(2)}%</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4">
                            {result.dividendYield != null && result.dividendYield > 0
                              ? <span className="text-yellow-400 font-bold text-base">{result.dividendYield.toFixed(2)}%</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {result.dividendFrequencyLabel
                              ? <span className="text-xs text-blue-300 font-medium">{result.dividendFrequencyLabel}</span>
                              : <span className="text-gray-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {result.fundamentalScore
                              ? <GradeBadge grade={result.fundamentalScore.grade} total={result.fundamentalScore.total} />
                              : <span className="text-xs text-gray-500">N/A</span>}
                          </td>
                          <td className="py-3 px-4">
                            {result.priceDiscountFromPeak != null && result.priceDiscountFromPeak > 0
                              ? <span className="text-orange-400 font-semibold">-{result.priceDiscountFromPeak.toFixed(1)}%</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-[50px] bg-dark-600 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, result.taScore)}%` }} />
                          </div>
                          <span className="text-gray-300 font-medium">{Math.round(result.taScore)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(result.presetCriteria ?? []).filter(c => c.passed).slice(0, 3).map((c, idx) => (
                            <span key={idx} className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-medium" title={c.threshold}>
                              ✓ {c.label}: {c.value}
                            </span>
                          ))}
                          {(result.presetCriteria ?? []).filter(c => c.passed).length === 0 && (
                            <span className="text-[10px] text-gray-500">See details ↓</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <ChevronRight className={`w-4 h-4 inline text-gray-500 group-hover:text-white transition-transform ${isExpanded ? 'rotate-90 text-white' : ''}`} />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={colSpan} className="bg-dark-900/60 p-4 border-b border-dark-700">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {result.fundamentalScore && (
                              <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                                <h4 className="font-bold text-blue-400 text-xs uppercase tracking-wider mb-3">Fundamental Quality</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  {[
                                    ['Valuation', `${result.fundamentalScore.valuation}/20`],
                                    ['Growth', `${result.fundamentalScore.growth}/20`],
                                    ['Profitability', `${result.fundamentalScore.profitability}/15`],
                                    ['Health', `${result.fundamentalScore.health}/15`],
                                    ['Cash Flow', `${result.fundamentalScore.cashFlow}/15`],
                                    ['Analyst', `${result.fundamentalScore.analyst}/15`],
                                  ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between border-b border-dark-700 py-0.5">
                                      <span className="text-gray-400">{label}:</span>
                                      <span className="font-semibold text-white">{val}</span>
                                    </div>
                                  ))}
                                </div>
                                {result.fundamentalScore.signals.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1">
                                    {result.fundamentalScore.signals.map((s, i) => (
                                      <span key={i} className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">✓ {s}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {result.presetCriteria && result.presetCriteria.length > 0 && (
                              <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                                <h4 className="font-bold text-purple-400 text-xs uppercase tracking-wider mb-3">
                                  {isDefensive ? 'Defensive' : 'Dividend'} Criteria Check
                                </h4>
                                <div className="space-y-1.5">
                                  {result.presetCriteria.map((c, i) => (
                                    <div key={i} className={`flex justify-between text-xs rounded px-2 py-1 ${c.passed ? 'bg-green-500/5 text-green-300' : 'bg-red-500/5 text-red-400'}`}>
                                      <span>{c.passed ? '✓' : '✗'} {c.label}</span>
                                      <span className="font-mono">{c.value} <span className="text-gray-500">({c.threshold})</span></span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/stock/${result.symbol}?market=${marketTab}`); }}
                            className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                          >
                            View full analysis for {sym} →
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
