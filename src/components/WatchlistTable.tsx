'use client';
import Link from 'next/link';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { usePortfolioStore } from '@/lib/portfolioStore';
import { useHydration } from '@/lib/useHydration';
import { Market, WatchlistItem, Signal } from '@/types';
import SignalBadge from './SignalBadge';
import MarketToggle from './MarketToggle';
import StockSearch from './StockSearch';
import {
  Eye,
  Plus,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  X,
  AlertCircle,
  Loader2,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronDown,
} from 'lucide-react';

type MarketTab = 'ALL' | 'US' | 'ID';
type SortField = 'pnlPercent' | 'name' | 'buyDate' | 'currentPrice' | 'buyPrice';
type SortDirection = 'asc' | 'desc';
type SignalFilter = 'ALL' | Signal;

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'pnlPercent', label: 'P&L %' },
  { value: 'name', label: 'Name' },
  { value: 'buyDate', label: 'Buy Date' },
  { value: 'currentPrice', label: 'Current Price' },
  { value: 'buyPrice', label: 'Buy Price' },
];

const SIGNAL_OPTIONS: { value: SignalFilter; label: string; color: string }[] = [
  { value: 'ALL', label: 'All Signals', color: 'text-gray-400' },
  { value: 'STRONG_BUY', label: 'Strong Buy', color: 'text-emerald-400' },
  { value: 'BUY', label: 'Buy', color: 'text-green-400' },
  { value: 'HOLD', label: 'Hold', color: 'text-yellow-400' },
  { value: 'SELL', label: 'Sell', color: 'text-orange-400' },
  { value: 'STRONG_SELL', label: 'Strong Sell', color: 'text-red-400' },
  { value: 'NO_SIGNAL', label: 'No Signal', color: 'text-slate-400' },
];

export function buildClosedPositionFromWatchlistItem({
  item,
  sellPrice,
}: {
  item: WatchlistItem;
  sellPrice: number;
}) {
  const eps = item.market === 'ID' ? 1 : 0.01;
  const hitSL =
    item.stopLossPrice != null && item.stopLossPrice > 0
      ? sellPrice <= item.stopLossPrice + eps
      : false;
  const hitTP =
    item.takeProfitPrice != null && item.takeProfitPrice > 0
      ? sellPrice >= item.takeProfitPrice - eps
      : false;

  const exitReason = hitSL ? ('STOP_LOSS' as const) : hitTP ? ('TAKE_PROFIT' as const) : ('MANUAL' as const);
  const hadPlan =
    (item.stopLossPrice != null && item.stopLossPrice > 0) ||
    (item.takeProfitPrice != null && item.takeProfitPrice > 0);
  const followedPlan = !hadPlan ? true : hitSL || hitTP;
  const planAnalysis = !hadPlan
    ? 'No SL/TP plan recorded.'
    : hitSL
      ? 'Closed at/under stop loss - followed SL plan.'
      : hitTP
        ? 'Closed at/above take profit - followed TP plan.'
        : 'Closed away from SL/TP levels - did not follow the recorded plan.';
  const pnl = (sellPrice - item.buyPrice) * item.quantity * (item.market === 'ID' ? 100 : 1);
  const pnlPercent = ((sellPrice - item.buyPrice) / item.buyPrice) * 100;

  return {
    id: `closed-${item.id}-${Date.now()}`,
    symbol: item.symbol,
    market: item.market,
    name: item.name,
    buyPrice: item.buyPrice,
    stopLossPrice: item.stopLossPrice ?? null,
    takeProfitPrice: item.takeProfitPrice ?? null,
    buyDate: item.buyDate,
    sellPrice,
    sellDate: new Date().toISOString().split('T')[0],
    quantity: item.quantity,
    pnl,
    pnlPercent,
    exitReason,
    followedPlan,
    planAnalysis,
  };
}

function MarketSummaryBar({ items, market, formatCurrency }: {
  items: WatchlistItem[];
  market: Market;
  formatCurrency: (v: number, m: Market) => string;
}) {
  const winners = items.filter((i) => (i.pnlPercent ?? 0) >= 0).length;
  const losers = items.length - winners;
  const avgPnl = items.length > 0
    ? items.reduce((sum, i) => sum + (i.pnlPercent ?? 0), 0) / items.length
    : 0;
  const totalInvested = items.reduce((sum, i) => sum + i.buyPrice * i.quantity * (market === 'ID' ? 100 : 1), 0);
  const totalCurrent = items.reduce((sum, i) => sum + (i.currentPrice ?? i.buyPrice) * i.quantity * (market === 'ID' ? 100 : 1), 0);
  const totalPnl = totalCurrent - totalInvested;
  const isPositive = avgPnl >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Positions</p>
        <p className="text-lg font-bold text-white">{items.length}</p>
      </div>
      <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Win / Loss</p>
        <p className="text-lg font-bold">
          <span className="text-green-400">{winners}</span>
          <span className="text-gray-600 mx-1">/</span>
          <span className="text-red-400">{losers}</span>
        </p>
      </div>
      <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Avg P&L</p>
        <p className={`text-lg font-bold flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {isPositive ? '+' : ''}{avgPnl.toFixed(2)}%
        </p>
      </div>
      <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total P&L</p>
        <p className={`text-lg font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, market)}
        </p>
      </div>
    </div>
  );
}

export default function WatchlistTable() {
  const hydrated = useHydration();
  const { closePosition, clearClosedPositions } = usePortfolioStore();
  const { items, addItem, removeItem, updateItem, clearAll } = useWatchlistStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addMarket, setAddMarket] = useState<Market>('US');
  const [addSymbol, setAddSymbol] = useState('');
  const [addBuyPrice, setAddBuyPrice] = useState('');
  const [addStopLoss, setAddStopLoss] = useState('');
  const [addTakeProfit, setAddTakeProfit] = useState('');
  const [addQuantity, setAddQuantity] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filter & sort state
  const [marketTab, setMarketTab] = useState<MarketTab>('ALL');
  const [sortField, setSortField] = useState<SortField>('pnlPercent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const refreshWatchlist = useCallback(async () => {
    if (items.length === 0) return;

    setRefreshing(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            symbol: i.symbol,
            market: i.market,
            buyPrice: i.buyPrice,
            quantity: i.quantity,
            stopLossPrice: i.stopLossPrice ?? null,
            takeProfitPrice: i.takeProfitPrice ?? null,
          })),
        }),
      });

      const data = await res.json();
      if (data.updates) {
        for (const update of data.updates) {
          updateItem(update.id, update);
        }
      }
    } catch (err) {
      console.error('Failed to refresh watchlist:', err);
    } finally {
      setRefreshing(false);
    }
  }, [items, updateItem]);

  useEffect(() => {
    if (hydrated && items.length > 0) {
      refreshWatchlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Derived: filtered & sorted items
  const usItems = useMemo(() => items.filter((i) => i.market === 'US'), [items]);
  const idItems = useMemo(() => items.filter((i) => i.market === 'ID'), [items]);

  const filteredAndSortedItems = useMemo(() => {
    let filtered = marketTab === 'ALL' ? items : marketTab === 'US' ? usItems : idItems;

    if (signalFilter !== 'ALL') {
      filtered = filtered.filter((i) => i.action === signalFilter);
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'pnlPercent':
          cmp = (a.pnlPercent ?? 0) - (b.pnlPercent ?? 0);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'buyDate':
          cmp = a.buyDate.localeCompare(b.buyDate);
          break;
        case 'currentPrice':
          cmp = (a.currentPrice ?? 0) - (b.currentPrice ?? 0);
          break;
        case 'buyPrice':
          cmp = a.buyPrice - b.buyPrice;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [items, usItems, idItems, marketTab, signalFilter, sortField, sortDirection]);

  const handleAdd = async () => {
    if (!addSymbol || !addBuyPrice || !addQuantity) {
      setError('Please fill all fields.');
      return;
    }

    setError('');

    try {
      const res = await fetch(`/api/stock?symbol=${addSymbol}&market=${addMarket}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      addItem({
        symbol: addSymbol.toUpperCase(),
        market: addMarket,
        name: data.quote.name,
        buyPrice: parseFloat(addBuyPrice),
        stopLossPrice: addStopLoss ? parseFloat(addStopLoss) : null,
        takeProfitPrice: addTakeProfit ? parseFloat(addTakeProfit) : null,
        buyDate: addDate,
        quantity: parseInt(addQuantity),
      });

      setAddSymbol('');
      setAddBuyPrice('');
      setAddStopLoss('');
      setAddTakeProfit('');
      setAddQuantity('');
      setShowAdd(false);

      setTimeout(() => refreshWatchlist(), 500);
    } catch (err: any) {
      setError(err.message || 'Failed to add stock.');
    }
  };

  const formatCurrency = (value: number | undefined | null, market: Market) => {
    const val = value ?? 0;
    if (market === 'ID') {
      return `Rp${val.toLocaleString('id-ID')}`;
    }
    return `$${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const toggleSortDirection = () => {
    setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  // Show loading skeleton until hydrated
  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-3" />
          <span className="text-gray-400">Loading watchlist...</span>
        </div>
      </div>
    );
  }

  const marketTabs: { key: MarketTab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: items.length },
    { key: 'US', label: '🇺🇸 US', count: usItems.length },
    { key: 'ID', label: '🇮🇩 IDX', count: idItems.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">
            Your Watchlist ({items.length} stocks)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Reset all watchlist data and closed positions? This cannot be undone.')) {
                  clearAll();
                  clearClosedPositions();
                }
              }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-2"
              title="Reset watchlist & related portfolio data"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            onClick={refreshWatchlist}
            disabled={refreshing || items.length === 0}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? 'Cancel' : 'Add Stock'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card animate-slide-up">
          <h3 className="text-sm font-bold text-white mb-4">Add Stock to Watchlist</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Market</label>
              <MarketToggle market={addMarket} onChange={setAddMarket} />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Stock</label>
              <StockSearch onSelect={(sym, mkt) => { setAddSymbol(sym); setAddMarket(mkt); }} />
            </div>

            <div>
              <label className="label">
                Buy Price ({addMarket === 'ID' ? 'Rp' : '$'})
              </label>
              <input
                type="number"
                value={addBuyPrice}
                onChange={(e) => setAddBuyPrice(e.target.value)}
                placeholder="Your buy price"
                className="input-field"
                min="0"
                step="any"
              />
            </div>

            <div>
              <label className="label">
                Stop Loss Price ({addMarket === 'ID' ? 'Rp' : '$'}) <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="number"
                value={addStopLoss}
                onChange={(e) => setAddStopLoss(e.target.value)}
                placeholder="Your stop-loss price"
                className="input-field"
                min="0"
                step="any"
              />
            </div>

            <div>
              <label className="label">
                Take Profit Price ({addMarket === 'ID' ? 'Rp' : '$'}) <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="number"
                value={addTakeProfit}
                onChange={(e) => setAddTakeProfit(e.target.value)}
                placeholder="Your take-profit price"
                className="input-field"
                min="0"
                step="any"
              />
            </div>

            <div>
              <label className="label">
                Quantity ({addMarket === 'ID' ? 'lots' : 'shares'})
              </label>
              <input
                type="number"
                value={addQuantity}
                onChange={(e) => setAddQuantity(e.target.value)}
                placeholder={addMarket === 'ID' ? 'Number of lots' : 'Number of shares'}
                className="input-field"
                min="1"
              />
            </div>

            <div>
              <label className="label">Buy Date</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAdd}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add to Watchlist
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="card text-center py-12">
          <Eye className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-400 mb-2">No stocks in watchlist</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add stocks you&apos;ve purchased to track performance and get action recommendations.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Stock
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Market Tabs */}
          <div className="flex items-center gap-1 bg-dark-800 rounded-xl p-1 border border-dark-600">
            {marketTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMarketTab(tab.key)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  marketTab === tab.key
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-dark-600'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    marketTab === tab.key
                      ? 'bg-blue-500/40 text-blue-100'
                      : 'bg-dark-500 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sort & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Sort */}
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort</span>
              </div>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none flex-1 sm:flex-initial"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={toggleSortDirection}
                className={`p-2 rounded-lg border transition-all duration-200 ${
                  sortDirection === 'desc'
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                    : 'bg-dark-800 border-dark-500 text-gray-400 hover:text-white'
                }`}
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Signal Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Signal</span>
              </div>
              <select
                value={signalFilter}
                onChange={(e) => setSignalFilter(e.target.value as SignalFilter)}
                className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none flex-1 sm:flex-initial"
              >
                {SIGNAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {signalFilter !== 'ALL' && (
                <button
                  onClick={() => setSignalFilter('ALL')}
                  className="p-2 rounded-lg bg-dark-800 border border-dark-500 text-gray-400 hover:text-white hover:border-dark-400 transition-all duration-200"
                  title="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Market Summary */}
          {marketTab === 'ALL' && items.length > 0 && (
            <div className="space-y-4">
              {usItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    🇺🇸 US Market
                  </h3>
                  <MarketSummaryBar items={usItems} market="US" formatCurrency={formatCurrency} />
                </div>
              )}
              {idItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    🇮🇩 IDX Market
                  </h3>
                  <MarketSummaryBar items={idItems} market="ID" formatCurrency={formatCurrency} />
                </div>
              )}
            </div>
          )}
          {marketTab === 'US' && usItems.length > 0 && (
            <MarketSummaryBar items={usItems} market="US" formatCurrency={formatCurrency} />
          )}
          {marketTab === 'ID' && idItems.length > 0 && (
            <MarketSummaryBar items={idItems} market="ID" formatCurrency={formatCurrency} />
          )}

          {/* Filtered items count */}
          {(signalFilter !== 'ALL' || marketTab !== 'ALL') && (
            <p className="text-xs text-gray-500">
              Showing {filteredAndSortedItems.length} of {items.length} positions
              {signalFilter !== 'ALL' && (
                <span className="ml-1">
                  · filtered by <span className="text-gray-400">{SIGNAL_OPTIONS.find((s) => s.value === signalFilter)?.label}</span>
                </span>
              )}
            </p>
          )}

          {/* Stock Cards */}
          {filteredAndSortedItems.length === 0 ? (
            <div className="card text-center py-8">
              <Filter className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No positions match the current filters.</p>
              <button
                onClick={() => { setSignalFilter('ALL'); setMarketTab('ALL'); }}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedItems.map((item) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onClose={(sellPrice: number) => {
                    closePosition(buildClosedPositionFromWatchlistItem({ item, sellPrice }));
                    removeItem(item.id);
                  }}
                  onUpdate={(updates) => {
                    updateItem(item.id, updates);
                    setTimeout(() => refreshWatchlist(), 500);
                  }}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}

          {items.length > 1 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all items?')) {
                  clearAll();
                }
              }}
              className="w-full py-3 text-sm text-gray-500 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WatchlistCard({
  item,
  onRemove,
  onClose,
  onUpdate,
  formatCurrency,
}: {
  item: WatchlistItem;
  onRemove: () => void;
  onClose: (sellPrice: number) => void;
  onUpdate: (updates: Partial<WatchlistItem>) => void;
  formatCurrency: (v: number, m: Market) => string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [sellPrice, setSellPrice] = useState(item.currentPrice || item.buyPrice);
  const isProfit = (item.pnlPercent ?? 0) >= 0;

  // Edit form state
  const [editBuyPrice, setEditBuyPrice] = useState(String(item.buyPrice));
  const [editQuantity, setEditQuantity] = useState(String(item.quantity));
  const [editStopLoss, setEditStopLoss] = useState(item.stopLossPrice ? String(item.stopLossPrice) : '');
  const [editTakeProfit, setEditTakeProfit] = useState(item.takeProfitPrice ? String(item.takeProfitPrice) : '');
  const [editBuyDate, setEditBuyDate] = useState(item.buyDate);

  const openEditForm = () => {
    // Reset edit fields to current values when opening
    setEditBuyPrice(String(item.buyPrice));
    setEditQuantity(String(item.quantity));
    setEditStopLoss(item.stopLossPrice ? String(item.stopLossPrice) : '');
    setEditTakeProfit(item.takeProfitPrice ? String(item.takeProfitPrice) : '');
    setEditBuyDate(item.buyDate);
    setShowEditForm(true);
    setShowCloseForm(false);
  };

  const handleSaveEdit = () => {
    const newBuyPrice = parseFloat(editBuyPrice);
    const newQuantity = parseInt(editQuantity);
    if (isNaN(newBuyPrice) || newBuyPrice <= 0 || isNaN(newQuantity) || newQuantity <= 0) return;

    onUpdate({
      buyPrice: newBuyPrice,
      quantity: newQuantity,
      stopLossPrice: editStopLoss ? parseFloat(editStopLoss) : null,
      takeProfitPrice: editTakeProfit ? parseFloat(editTakeProfit) : null,
      buyDate: editBuyDate,
    });
    setShowEditForm(false);
  };

  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-white">{item.symbol}</h3>
            <span className="text-xs bg-dark-600 text-gray-400 px-2 py-0.5 rounded-full">
              {item.market === 'ID' ? '🇮🇩' : '🇺🇸'}
            </span>
            <SignalBadge signal={item.action} size="sm" />
            {item.fundamentalScore && (
              <span 
                className={`text-xs px-2 py-0.5 rounded-full font-bold transition-all duration-200 ${
                  item.fundamentalScore.grade === 'A'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : item.fundamentalScore.grade === 'B'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : item.fundamentalScore.grade === 'C'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                        : item.fundamentalScore.grade === 'D'
                          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
                title={`Fundamental Quality Score: ${item.fundamentalScore.total}/100. Valuation: ${item.fundamentalScore.valuation}/20, Growth: ${item.fundamentalScore.growth}/20, Profitability: ${item.fundamentalScore.profitability}/15, Health: ${item.fundamentalScore.health}/15, Cash Flow: ${item.fundamentalScore.cashFlow}/15, Analyst: ${item.fundamentalScore.analyst}/15.`}
              >
                Quality: {item.fundamentalScore.grade} ({item.fundamentalScore.total})
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{item.name}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={openEditForm}
            className="text-gray-600 hover:text-blue-400 transition-colors p-1"
            title="Edit Position"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowCloseForm(!showCloseForm); setShowEditForm(false); }}
            className="text-xs bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-white px-2 py-1 rounded-lg transition-colors"
            title="Close Position (Sell)"
          >
            {showCloseForm ? 'Cancel' : 'Close'}
          </button>
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Position Form */}
      {showEditForm && (
        <div className="mt-4 bg-dark-800 rounded-xl p-4 border border-blue-500/30 animate-slide-up">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5 text-blue-400" />
            Edit Position
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Avg. Buy Price ({item.market === 'ID' ? 'Rp' : '$'})</label>
              <input
                type="number"
                value={editBuyPrice}
                onChange={(e) => setEditBuyPrice(e.target.value)}
                className="input-field"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label className="label">Quantity ({item.market === 'ID' ? 'lots' : 'shares'})</label>
              <input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="input-field"
                min="1"
              />
            </div>
            <div>
              <label className="label">Stop Loss <span className="text-gray-600">(opt)</span></label>
              <input
                type="number"
                value={editStopLoss}
                onChange={(e) => setEditStopLoss(e.target.value)}
                className="input-field"
                min="0"
                step="any"
                placeholder="—"
              />
            </div>
            <div>
              <label className="label">Take Profit <span className="text-gray-600">(opt)</span></label>
              <input
                type="number"
                value={editTakeProfit}
                onChange={(e) => setEditTakeProfit(e.target.value)}
                className="input-field"
                min="0"
                step="any"
                placeholder="—"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Buy Date</label>
              <input
                type="date"
                value={editBuyDate}
                onChange={(e) => setEditBuyDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSaveEdit}
              className="btn-primary flex-1 py-2 text-xs flex items-center justify-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              Save Changes
            </button>
            <button
              onClick={() => setShowEditForm(false)}
              className="btn-secondary flex-1 py-2 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close Position Form */}
      {showCloseForm && (
        <div className="mt-4 bg-dark-800 rounded-xl p-4 border border-dark-600">
          <h4 className="text-sm font-bold text-white mb-2">Close Position</h4>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(parseFloat(e.target.value))}
              placeholder="Sell Price"
              className="input-field flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm(`Close ${item.symbol} position at ${formatCurrency(sellPrice, item.market)}?`)) {
                  onClose(sellPrice);
                }
              }}
              className="btn-primary flex-1 py-2 text-xs"
            >
              Confirm Close
            </button>
            <button
              onClick={() => setShowCloseForm(false)}
              className="btn-secondary flex-1 py-2 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Prices */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <p className="text-xs text-gray-500">Buy Price</p>
          <p className="text-sm font-semibold text-gray-300">
            {formatCurrency(item.buyPrice, item.market)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current</p>
          <p className="text-sm font-semibold text-white">
            {formatCurrency(item.currentPrice, item.market)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">P&L</p>
          <p
            className={`text-sm font-bold flex items-center gap-1 ${
              isProfit ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isProfit ? '+' : ''}
            {(item.pnlPercent ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>



      {/* Action Reason */}
      <button onClick={() => setShowDetails(!showDetails)} className="mt-3 w-full text-left">
        <div
          className={`rounded-xl p-3 text-sm border ${
            item.action === 'STRONG_SELL' || item.action === 'SELL'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : item.action === 'STRONG_BUY' || item.action === 'BUY'
                ? 'bg-green-500/10 border-green-500/20 text-green-300'
                : item.action === 'NO_SIGNAL'
                  ? 'bg-slate-500/10 border-slate-500/20 text-slate-300'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
          }`}
        >
          <p className="font-medium mb-1">Recommended Action</p>
          <p className="text-xs opacity-80 leading-relaxed">{item.actionReason}</p>
        </div>
      </button>

      {showDetails && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 animate-fade-in">
          <div>
            Quantity: {item.quantity} {item.market === 'ID' ? 'lots' : 'shares'}
          </div>
          <div>Buy Date: {item.buyDate}</div>
          <div>
            Stop Loss: {item.stopLossPrice ? formatCurrency(item.stopLossPrice, item.market) : '—'}
          </div>
          <div>
            Take Profit: {item.takeProfitPrice ? formatCurrency(item.takeProfitPrice, item.market) : '—'}
          </div>
          <div className="col-span-2">
            Last Updated: {item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : 'Never'}
          </div>
        </div>
      )}
    </div>
  );
}
