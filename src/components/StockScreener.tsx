'use client';

import { useState, useMemo, useCallback } from 'react';
import { Market } from '@/types';
import {
  ScreenerFilters,
  ScreenerResult,
  ScreenerResponse,
  ScreenerPreset,
  ScreenerFilterKey,
  FilterRange,
  FILTER_METADATA,
  FilterMeta,
} from '@/types/screener';
import { SCREENER_PRESETS } from '@/lib/screenerPresets';
import MarketToggle from './MarketToggle';
import {
  Search,
  Filter,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  RotateCcw,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';

// ============================================================
// Helpers
// ============================================================

function formatMetricValue(value: number | null, meta: FilterMeta): string {
  if (value === null || value === undefined) return '—';

  if (meta.key === 'marketCap') {
    if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
  }

  if (meta.key === 'freeCashFlow') {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
  }

  if (meta.key === 'avgVolume3M') {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toLocaleString();
  }

  if (meta.suffix === '%') return `${value.toFixed(1)}%`;
  if (meta.suffix === 'x') return `${value.toFixed(1)}x`;
  return value.toFixed(2);
}

type SortField = ScreenerFilterKey | 'symbol' | 'name';
type SortDirection = 'asc' | 'desc';

// ============================================================
// Category config
// ============================================================

const CATEGORIES = [
  { id: 'valuation', label: 'Valuation', emoji: '💰' },
  { id: 'profitability', label: 'Profitability', emoji: '📊' },
  { id: 'growth', label: 'Growth', emoji: '🚀' },
  { id: 'health', label: 'Financial Health', emoji: '🏦' },
  { id: 'income', label: 'Income & Size', emoji: '💵' },
  { id: 'trading', label: 'Trading', emoji: '📉' },
] as const;

// ============================================================
// Main Component
// ============================================================

export default function StockScreener() {
  // State
  const [market, setMarket] = useState<Market>('US');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('graham');
  const [filters, setFilters] = useState<ScreenerFilters>(
    SCREENER_PRESETS[0].filters
  );
  const [showFilters, setShowFilters] = useState(false);
  const [additionalSymbols, setAdditionalSymbols] = useState('');
  const [results, setResults] = useState<ScreenerResult[] | null>(null);
  const [screening, setScreening] = useState(false);
  const [error, setError] = useState('');
  const [screenStats, setScreenStats] = useState<{
    totalScreened: number;
    totalMatched: number;
    errors: string[];
  } | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Apply preset
  const applyPreset = useCallback((preset: ScreenerPreset) => {
    setSelectedPreset(preset.id);
    setFilters({ ...preset.filters });
  }, []);

  // Update a single filter
  const updateFilter = useCallback(
    (key: ScreenerFilterKey, bound: 'min' | 'max', value: string) => {
      setSelectedPreset('custom');
      setFilters((prev) => {
        const existing = prev[key] || {};
        const parsed = value === '' ? undefined : parseFloat(value);
        const updated: FilterRange = { ...existing, [bound]: parsed };

        // Remove the filter entirely if both min and max are undefined
        if (updated.min === undefined && updated.max === undefined) {
          const next = { ...prev };
          delete next[key];
          return next;
        }

        return { ...prev, [key]: updated };
      });
    },
    []
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setSelectedPreset(null);
  }, []);

  // Active filter count
  const activeFilterCount = useMemo(
    () => Object.keys(filters).length,
    [filters]
  );

  // Run screener
  const runScreener = useCallback(async () => {
    if (activeFilterCount === 0) {
      setError('Please set at least one filter.');
      return;
    }

    setScreening(true);
    setError('');
    setResults(null);
    setScreenStats(null);

    try {
      const extraSymbols = additionalSymbols
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const res = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market,
          filters,
          additionalSymbols: extraSymbols.length > 0 ? extraSymbols : undefined,
        }),
      });

      const data: ScreenerResponse = await res.json();

      if (!res.ok) {
        throw new Error((data as any).error || 'Screener request failed');
      }

      setResults(data.results);
      setScreenStats({
        totalScreened: data.totalScreened,
        totalMatched: data.totalMatched,
        errors: data.errors,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to run screener');
    } finally {
      setScreening(false);
    }
  }, [market, filters, additionalSymbols, activeFilterCount]);

  // Sort results
  const sortedResults = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => {
      let aVal: any, bVal: any;

      if (sortField === 'symbol') {
        aVal = a.stock.symbol;
        bVal = b.stock.symbol;
      } else if (sortField === 'name') {
        aVal = a.stock.name;
        bVal = b.stock.name;
      } else {
        aVal = a.stock[sortField] ?? null;
        bVal = b.stock[sortField] ?? null;
      }

      // Nulls go to bottom
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [results, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Columns to display in the results table (only active filters + symbol)
  const displayColumns = useMemo(() => {
    const activeKeys = Object.keys(filters) as ScreenerFilterKey[];
    return FILTER_METADATA.filter((m) => activeKeys.includes(m.key));
  }, [filters]);

  return (
    <div className="space-y-6">
      {/* Market Selector */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Market</h3>
            <p className="text-xs text-gray-500">
              Select the market to screen stocks from
            </p>
          </div>
          <MarketToggle market={market} onChange={setMarket} />
        </div>

        {/* Additional Symbols (for US market especially) */}
        <div className="mt-4">
          <label className="label">
            Additional Symbols{' '}
            <span className="text-gray-600">(comma-separated)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={additionalSymbols}
              onChange={(e) => setAdditionalSymbols(e.target.value)}
              placeholder="e.g. AMD, NFLX, DIS"
              className="input-field text-sm py-2 flex-1"
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {market === 'US'
              ? 'Default US universe has 10 popular stocks. Add more tickers above.'
              : 'IDX universe has ~130 stocks. Add more if needed.'}
          </p>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-3">
          Screening Strategy
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SCREENER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                selectedPreset === preset.id
                  ? 'bg-blue-600/15 border-blue-500/40 ring-1 ring-blue-500/30'
                  : 'bg-dark-800 border-dark-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{preset.emoji}</span>
                <span className="text-sm font-bold text-white">
                  {preset.name}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {preset.description}
              </p>
            </button>
          ))}
        </div>

        {selectedPreset === 'custom' && (
          <div className="mt-3 text-xs text-yellow-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Custom filters active — not using a preset
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">
              Filters{' '}
              {activeFilterCount > 0 && (
                <span className="text-blue-400 font-normal">
                  ({activeFilterCount} active)
                </span>
              )}
            </h3>
          </div>
          {showFilters ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showFilters && (
          <div className="mt-4 space-y-6 animate-fade-in">
            {/* Clear button */}
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear All Filters
              </button>
            </div>

            {CATEGORIES.map((cat) => {
              const catFilters = FILTER_METADATA.filter(
                (m) => m.category === cat.id
              );
              return (
                <div key={cat.id}>
                  <h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                    <span>{cat.emoji}</span> {cat.label}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catFilters.map((meta) => {
                      const currentFilter = filters[meta.key];
                      const isActive =
                        currentFilter?.min !== undefined ||
                        currentFilter?.max !== undefined;

                      return (
                        <div
                          key={meta.key}
                          className={`bg-dark-800 rounded-xl p-3 border transition-colors ${
                            isActive
                              ? 'border-blue-500/30'
                              : 'border-dark-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-300">
                              {meta.label}
                            </span>
                            {isActive && (
                              <button
                                onClick={() => {
                                  setSelectedPreset('custom');
                                  setFilters((prev) => {
                                    const next = { ...prev };
                                    delete next[meta.key];
                                    return next;
                                  });
                                }}
                                className="text-gray-600 hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-600 block mb-0.5">
                                Min
                              </label>
                              <input
                                type="number"
                                value={currentFilter?.min ?? ''}
                                onChange={(e) =>
                                  updateFilter(meta.key, 'min', e.target.value)
                                }
                                placeholder="—"
                                step={meta.step}
                                className="w-full bg-dark-900 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-600 block mb-0.5">
                                Max
                              </label>
                              <input
                                type="number"
                                value={currentFilter?.max ?? ''}
                                onChange={(e) =>
                                  updateFilter(meta.key, 'max', e.target.value)
                                }
                                placeholder="—"
                                step={meta.step}
                                className="w-full bg-dark-900 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={runScreener}
        disabled={screening || activeFilterCount === 0}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
      >
        {screening ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Screening stocks...
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            Run Screener ({activeFilterCount} filter
            {activeFilterCount !== 1 ? 's' : ''})
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results Summary */}
      {screenStats && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Search className="w-4 h-4" />
            <span>
              Screened: <strong className="text-white">{screenStats.totalScreened}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Matched: <strong>{screenStats.totalMatched}</strong>
            </span>
          </div>
          {screenStats.errors.length > 0 && (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              <span>
                {screenStats.errors.length} error
                {screenStats.errors.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Results Table */}
      {sortedResults && sortedResults.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-dark-600 bg-dark-800">
                  <th className="text-left py-3 px-4 sticky left-0 bg-dark-800 z-10">
                    <button
                      onClick={() => handleSort('symbol')}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      Symbol
                      {sortField === 'symbol' && (
                        <SortIcon direction={sortDirection} />
                      )}
                    </button>
                  </th>
                  {displayColumns.map((col) => (
                    <th key={col.key} className="text-right py-3 px-3 whitespace-nowrap">
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 ml-auto hover:text-white transition-colors"
                        title={col.description}
                      >
                        {col.shortLabel}
                        {sortField === col.key && (
                          <SortIcon direction={sortDirection} />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((result) => (
                  <tr
                    key={result.stock.symbol}
                    className="border-b border-dark-700 hover:bg-dark-800 transition-colors"
                  >
                    <td className="py-3 px-4 sticky left-0 bg-dark-700 z-10">
                      <div>
                        <span className="font-bold text-white">
                          {result.stock.symbol}
                        </span>
                        <span className="text-[10px] text-gray-600 ml-1.5">
                          {result.stock.market === 'ID' ? '🇮🇩' : '🇺🇸'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate max-w-[140px]">
                        {result.stock.name}
                      </p>
                    </td>
                    {displayColumns.map((col) => {
                      const value = result.stock[col.key] as number | null;
                      const range = filters[col.key];
                      const status = getValueStatus(value, range, col);

                      return (
                        <td
                          key={col.key}
                          className={`py-3 px-3 text-right whitespace-nowrap font-medium ${
                            status === 'good'
                              ? 'text-green-400'
                              : status === 'bad'
                              ? 'text-red-400'
                              : 'text-gray-300'
                          }`}
                        >
                          {formatMetricValue(value, col)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results */}
      {sortedResults && sortedResults.length === 0 && (
        <div className="card text-center py-12">
          <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-400 mb-2">
            No stocks matched
          </h3>
          <p className="text-sm text-gray-500">
            Try relaxing your filters or changing the market.
          </p>
        </div>
      )}

      {/* API Errors */}
      {screenStats && screenStats.errors.length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-300 transition-colors">
            {screenStats.errors.length} stocks failed to load (click to expand)
          </summary>
          <ul className="mt-2 space-y-1 pl-4 list-disc">
            {screenStats.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SortIcon({ direction }: { direction: SortDirection }) {
  return direction === 'asc' ? (
    <ChevronUp className="w-3 h-3" />
  ) : (
    <ChevronDown className="w-3 h-3" />
  );
}

function getValueStatus(
  value: number | null,
  range: FilterRange | undefined,
  meta: FilterMeta
): 'good' | 'bad' | 'neutral' {
  if (value === null || !range) return 'neutral';

  // Check if within range
  const withinMin = range.min === undefined || value >= range.min;
  const withinMax = range.max === undefined || value <= range.max;

  if (withinMin && withinMax) return 'good';
  return 'bad';
}
