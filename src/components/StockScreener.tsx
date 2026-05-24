'use client';

import React, { useState, useRef } from 'react';
import { Search, ChevronRight, Loader2, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Market, SwingScreenerResult } from '@/types';

type Preset = 'DEFAULT' | 'BREAKOUT' | 'OVERSOLD' | 'SMART_MONEY' | 'VOLUME_CLIMAX' | 'SHORT_SQUEEZE';

export default function StockScreener() {
  const router = useRouter();
  const [marketTab, setMarketTab] = useState<Market>('US');
  const [usUniverse, setUsUniverse] = useState('SP100');
  const [idUniverse, setIdUniverse] = useState('LQ45');
  const [preset, setPreset] = useState<Preset>('DEFAULT');

  const [results, setResults] = useState<SwingScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;

  const isCancelledRef = useRef(false);

  const handleCancelScreen = () => {
    isCancelledRef.current = true;
    setLoading(false);
    setError('Scanning cancelled.');
  };

  const handleRunScreen = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setProgress(0);
    setTablePage(1);
    isCancelledRef.current = false;

    const universe = marketTab === 'US' ? usUniverse : idUniverse;
    let currentPage = 1;
    let totalPages = 1;
    let accumulatedResults: SwingScreenerResult[] = [];

    try {
      while (currentPage <= totalPages) {
        if (isCancelledRef.current) {
          break;
        }
        const res = await fetch(`/api/screener?market=${marketTab}&universe=${universe}&preset=${preset}&page=${currentPage}&limit=10`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to run screener');
        }

        accumulatedResults = [...accumulatedResults, ...(data.results || [])];
        setResults(accumulatedResults.sort((a, b) => {
          // Primary sort: accumulation score (smart money first)
          const aAcc = a.smartMoney?.accumulationScore ?? 0;
          const bAcc = b.smartMoney?.accumulationScore ?? 0;
          if (bAcc !== aAcc) return bAcc - aAcc;
          // Secondary sort: TA score
          return b.taScore - a.taScore;
        }));
        
        totalPages = data.pagination.totalPages;
        setProgress(Math.round((currentPage / totalPages) * 100));
        currentPage++;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (!isCancelledRef.current) {
        setProgress(100);
      }
    }
  };

  const handleRowClick = (symbol: string) => {
    setExpandedSymbol(expandedSymbol === symbol ? null : symbol);
  };

  const paginatedResults = results.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize);

  return (
    <div className="space-y-6">
      {/* Market Tabs */}
      <div className="flex items-center gap-4 border-b border-dark-600 pb-2">
        <button
          onClick={() => { setMarketTab('US'); setResults([]); }}
          className={`pb-2 px-2 text-lg font-bold border-b-2 transition-colors ${
            marketTab === 'US'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          🇺🇸 US Market
        </button>
        <button
          onClick={() => { setMarketTab('ID'); setResults([]); }}
          className={`pb-2 px-2 text-lg font-bold border-b-2 transition-colors ${
            marketTab === 'ID'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          🇮🇩 IDX Market
        </button>
      </div>

      {/* Universe & Preset Selectors */}
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-dark-800 p-4 rounded-xl border border-dark-600">
        <div className="flex-1 w-full">
          <label className="block text-xs text-gray-400 mb-1">Stock Universe</label>
          {marketTab === 'US' ? (
            <select
              value={usUniverse}
              onChange={(e) => setUsUniverse(e.target.value)}
              className="input-field py-2"
            >
              <option value="SP100">S&P 100 (Large Cap)</option>
              <option value="TECH">Top US Tech</option>
            </select>
          ) : (
            <select
              value={idUniverse}
              onChange={(e) => setIdUniverse(e.target.value)}
              className="input-field py-2"
            >
              <option value="LQ45">LQ45 (Most Liquid)</option>
              <option value="KOMPAS100">Kompas 100</option>
              <option value="ALL">All IDX Stocks (~900)</option>
            </select>
          )}
        </div>

        <div className="flex-1 w-full">
          <label className="block text-xs text-gray-400 mb-1">Preset Setup</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="input-field py-2"
          >
            <option value="DEFAULT">Default (Smart Money → TA)</option>
            <option value="BREAKOUT">Breakout (Accumulation + Breakout TA)</option>
            <option value="OVERSOLD">Oversold Recovery (Accumulation + Bounce)</option>
            <option value="SMART_MONEY">Strong Smart Money (3+ Signals)</option>
            <option value="VOLUME_CLIMAX">Volume Climax (Accumulation + Surge)</option>
            {marketTab === 'US' && <option value="SHORT_SQUEEZE">Short Squeeze (US Only)</option>}
          </select>
        </div>
        
        <button 
          onClick={handleRunScreen} 
          disabled={loading}
          className="btn-primary py-2 px-6 w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2 inline" />
              Run Screen
            </>
          )}
        </button>
      </div>

      {/* Progress Bar */}
      {loading && (
        <div className="flex items-center gap-4 bg-dark-800 p-3 rounded-xl border border-dark-600 animate-pulse">
          <div className="flex-1 bg-dark-900 rounded-full h-2 overflow-hidden border border-dark-700">
            <div 
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            onClick={handleCancelScreen}
            className="text-xs bg-dark-600 hover:bg-dark-500 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-dark-500 transition-colors"
          >
            Cancel Scan
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Results Table */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>Screener Results</span>
          {results.length > 0 && (
            <span className="text-xs bg-dark-600 text-gray-400 px-2 py-1 rounded">
              {results.length} Passed
            </span>
          )}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-dark-600">
                <th className="py-3 px-4 font-semibold">Symbol</th>
                <th className="py-3 px-4 font-semibold">Smart Money</th>
                <th className="py-3 px-4 font-semibold">TA Score</th>
                <th className="py-3 px-4 font-semibold">Signals</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && results.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Scanning {marketTab === 'US' ? usUniverse : idUniverse} for {preset} setups...<br/>
                    <span className="text-xs">Filtering by smart money accumulation first, then scoring technical setups.</span>
                  </td>
                </tr>
              )}

              {!loading && results.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    <Info className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                    No stocks passed the current screening criteria.
                  </td>
                </tr>
              )}

              {paginatedResults.map((result) => {
                const isExpanded = expandedSymbol === result.symbol;
                return (
                  <React.Fragment key={result.symbol}>
                    <tr 
                      className="border-b border-dark-700 hover:bg-dark-800 cursor-pointer transition-colors group"
                      onClick={() => handleRowClick(result.symbol)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{result.symbol.replace('.JK', '')}</div>
                        <div className="text-xs text-gray-500">{marketTab === 'US' ? '🇺🇸 US' : '🇮🇩 IDX'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {result.smartMoney ? (
                          <div className="flex items-center gap-2">
                            <div className="w-full max-w-[60px] bg-dark-600 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${result.smartMoney.accumulationScore >= 60 ? 'bg-green-500' : result.smartMoney.accumulationScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, result.smartMoney.accumulationScore)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${result.smartMoney.accumulationScore >= 60 ? 'text-green-400' : result.smartMoney.accumulationScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {result.smartMoney.signalCount}/{result.smartMoney.totalSignals}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full max-w-[60px] bg-dark-600 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${Math.min(100, Math.max(0, result.taScore))}%` }}
                            />
                          </div>
                          <span className="text-gray-300 font-medium">{result.taScore}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {result.signals.slice(0, 2).map((sig, idx) => (
                            <span key={idx} className="text-[10px] bg-dark-600 text-gray-300 px-1.5 py-0.5 rounded border border-dark-500">
                              {sig}
                            </span>
                          ))}
                          {result.signals.length > 2 && (
                            <span className="text-[10px] text-gray-500">+{result.signals.length - 2} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className={`w-4 h-4 inline text-gray-500 group-hover:text-white transition-transform ${isExpanded ? 'rotate-90 text-white' : ''}`} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="bg-dark-900/60 p-4 border-b border-dark-700">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
                            {/* Smart Money details */}
                            <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                              <h4 className="font-bold text-white mb-2 uppercase text-xs tracking-wider text-blue-400">Smart Money Breakdown</h4>
                              {result.smartMoney ? (
                                <div className="space-y-1 text-xs text-gray-300">
                                  <div>Accumulation Score: <span className="font-semibold text-white">{result.smartMoney.accumulationScore}</span></div>
                                  <div>Signals Bullish: <span className="font-semibold text-white">{result.smartMoney.signalCount} of {result.smartMoney.totalSignals}</span></div>
                                  <div className="mt-2 space-y-1">
                                    <div className="flex justify-between border-b border-dark-700 py-0.5">
                                      <span>A/D Trend Bullish</span>
                                      <span className={result.smartMoney.adTrendBullish ? 'text-green-400 font-medium' : 'text-gray-500'}>{result.smartMoney.adTrendBullish ? 'YES' : 'NO'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dark-700 py-0.5">
                                      <span>Chaikin Money Flow (CMF)</span>
                                      <span className={result.smartMoney.cmfBullish ? 'text-green-400 font-medium' : 'text-gray-500'}>{result.smartMoney.cmf.toFixed(2)} ({result.smartMoney.cmfBullish ? 'BULL' : 'BEAR'})</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dark-700 py-0.5">
                                      <span>OBV Volume Divergence</span>
                                      <span className={result.smartMoney.obvDivergence ? 'text-green-400 font-medium' : 'text-gray-500'}>{result.smartMoney.obvDivergence ? 'YES' : 'NO'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dark-700 py-0.5">
                                      <span>Volume Profile Status</span>
                                      <span className={result.smartMoney.volumeProfileBullish ? 'text-green-400 font-medium' : 'text-gray-500'}>{result.smartMoney.volumeProfileBullish ? 'ACCUMULATING' : 'NEUTRAL'}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span>Large Block Buying Activity</span>
                                      <span className={result.smartMoney.largeBlockBuying ? 'text-green-400 font-medium' : 'text-gray-500'}>{result.smartMoney.largeBlockBuying ? 'YES' : 'NO'}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">Smart money metrics not available.</p>
                              )}
                            </div>

                            {/* TA and action details */}
                            <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex flex-col justify-between">
                              <div>
                                <h4 className="font-bold text-white mb-2 uppercase text-xs tracking-wider text-blue-400">Technical Indicators & Risk</h4>
                                {result.taData ? (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div>RSI (14): <span className="font-semibold text-white">{result.taData.rsi?.toFixed(1) ?? '—'}</span></div>
                                    <div>ADX (14): <span className="font-semibold text-white">{result.taData.adx?.toFixed(1) ?? '—'}</span></div>
                                    <div>CCI (20): <span className="font-semibold text-white">{result.taData.cci?.toFixed(1) ?? '—'}</span></div>
                                    <div>Bollinger %B: <span className="font-semibold text-white">{result.taData.bollingerB?.toFixed(2) ?? '—'}</span></div>
                                    <div>ATR %: <span className="font-semibold text-white">{result.taData.atrPercent ? `${result.taData.atrPercent.toFixed(1)}%` : '—'}</span></div>
                                    <div>Vol Ratio: <span className="font-semibold text-white">{result.taData.volumeRatio?.toFixed(1) ?? '—'}x</span></div>
                                    <div>Pivot S1: <span className="font-semibold text-white">{result.taData.pivotS1 ? `${marketTab === 'ID' ? 'Rp' : '$'}${result.taData.pivotS1.toLocaleString(marketTab === 'ID' ? 'id-ID' : 'en-US')}` : '—'}</span></div>
                                    <div>Pivot R1: <span className="font-semibold text-white">{result.taData.pivotR1 ? `${marketTab === 'ID' ? 'Rp' : '$'}${result.taData.pivotR1.toLocaleString(marketTab === 'ID' ? 'id-ID' : 'en-US')}` : '—'}</span></div>
                                    <div className="col-span-2 mt-1">Supertrend: <span className={result.taData.supertrendBullish ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{result.taData.supertrendBullish ? 'BULLISH' : 'BEARISH'}</span></div>
                                    
                                    {/* Crossover Recency */}
                                    {(result.taData.emaCrossoverRecency !== null || result.taData.macdCrossoverRecency !== null || result.taData.priceCrossoverRecency !== null) && (
                                      <div className="col-span-2 mt-2 pt-2 border-t border-dark-700">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Crossover Recency</p>
                                        <div className="space-y-0.5 text-[11px]">
                                          {result.taData.emaCrossoverRecency !== null && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Golden Cross (EMA20 &gt; EMA50)</span>
                                              <span className="text-white font-medium">{result.taData.emaCrossoverRecency}d ago</span>
                                            </div>
                                          )}
                                          {result.taData.macdCrossoverRecency !== null && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">MACD Bullish Cross</span>
                                              <span className="text-white font-medium">{result.taData.macdCrossoverRecency}d ago</span>
                                            </div>
                                          )}
                                          {result.taData.priceCrossoverRecency !== null && (
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Price &gt; EMA20 Cross</span>
                                              <span className="text-white font-medium">{result.taData.priceCrossoverRecency}d ago</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Warning-level Red Flags */}
                                    {result.redFlags && result.redFlags.length > 0 && (
                                      <div className="col-span-2 mt-2 pt-2 border-t border-dark-700">
                                        <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1">Red Flags / Warnings</p>
                                        <div className="space-y-1">
                                          {result.redFlags.map((flag: any, idx: number) => (
                                            <div key={idx} className="text-[11px] leading-snug">
                                              <span className="text-yellow-400 font-semibold">{flag.title}:</span>{' '}
                                              <span className="text-gray-300">{flag.message}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500">Technical analysis indicators not available.</p>
                                )}
                              </div>

                              <div className="mt-4 pt-4 border-t border-dark-700 flex items-center justify-between gap-4">
                                <span className="text-xs text-gray-500">Want to see charts, red flags, and peers?</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/stock/${result.symbol}?market=${marketTab}`);
                                  }}
                                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
                                >
                                  View Detailed Analytics <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {loading && results.length > 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500 bg-dark-800/50">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto inline text-blue-500 mr-2" />
                    Scanning remaining chunks... ({progress}%)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {results.length > tablePageSize && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-400 px-2">
          <div>
            Showing {(tablePage - 1) * tablePageSize + 1} to {Math.min(tablePage * tablePageSize, results.length)} of {results.length} results
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setTablePage(p => Math.max(1, p - 1))}
              disabled={tablePage === 1}
              className="px-3 py-1 bg-dark-800 rounded hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button 
              onClick={() => setTablePage(p => Math.min(Math.ceil(results.length / tablePageSize), p + 1))}
              disabled={tablePage >= Math.ceil(results.length / tablePageSize)}
              className="px-3 py-1 bg-dark-800 rounded hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
