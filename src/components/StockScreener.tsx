'use client';

import React, { useState } from 'react';
import { Search, ChevronRight, Loader2, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Market } from '@/types';

type Preset = 'DEFAULT' | 'BREAKOUT' | 'OVERSOLD' | 'SMART_MONEY' | 'VOLUME_CLIMAX' | 'SHORT_SQUEEZE';

interface ScreenerResult {
  symbol: string;
  market: Market;
  taScore: number;
  smartMoney: {
    accumulationScore: number;
    signalCount: number;
    totalSignals: number;
    isPass: boolean;
  } | null;
  signals: string[];
  isPass: boolean;
}

export default function StockScreener() {
  const router = useRouter();
  const [marketTab, setMarketTab] = useState<Market>('US');
  const [usUniverse, setUsUniverse] = useState('SP100');
  const [idUniverse, setIdUniverse] = useState('LQ45');
  const [preset, setPreset] = useState<Preset>('DEFAULT');

  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;

  const handleRunScreen = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setProgress(0);
    setTablePage(1);

    const universe = marketTab === 'US' ? usUniverse : idUniverse;
    let currentPage = 1;
    let totalPages = 1;
    let accumulatedResults: ScreenerResult[] = [];

    try {
      while (currentPage <= totalPages) {
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
      setProgress(100);
    }
  };

  const handleRowClick = (symbol: string) => {
    router.push(`/stock/${symbol.replace('.JK', '')}?market=${marketTab}`);
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
        <div className="bg-dark-800 rounded-full h-2 overflow-hidden border border-dark-600">
          <div 
            className="bg-blue-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
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

              {paginatedResults.map((result) => (
                <tr 
                  key={result.symbol}
                  className="border-b border-dark-700 hover:bg-dark-800 cursor-pointer transition-colors"
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
                    <ChevronRight className="w-4 h-4 inline text-gray-500 group-hover:text-white" />
                  </td>
                </tr>
              ))}
              
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
