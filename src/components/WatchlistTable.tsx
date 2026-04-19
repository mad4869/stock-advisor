'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { usePortfolioStore } from '@/lib/portfolioStore';
import { useHydration } from '@/lib/useHydration';
import { Market, WatchlistItem } from '@/types';
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
} from 'lucide-react';

export default function WatchlistTable() {
  const hydrated = useHydration();
  const { closePosition } = usePortfolioStore();
  const { items, addItem, removeItem, updateItem, clearAll } = useWatchlistStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addMarket, setAddMarket] = useState<Market>('US');
  const [addSymbol, setAddSymbol] = useState('');
  const [addBuyPrice, setAddBuyPrice] = useState('');
  const [addQuantity, setAddQuantity] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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
        buyDate: addDate,
        quantity: parseInt(addQuantity),
      });

      setAddSymbol('');
      setAddBuyPrice('');
      setAddQuantity('');
      setShowAdd(false);

      setTimeout(() => refreshWatchlist(), 500);
    } catch (err: any) {
      setError(err.message || 'Failed to add stock.');
    }
  };

  const formatCurrency = (value: number, market: Market) => {
    if (market === 'ID') {
      return `Rp${value.toLocaleString('id-ID')}`;
    }
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
              <StockSearch market={addMarket} onSelect={(s) => setAddSymbol(s)} />
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
        <div className="space-y-4">
          {items.map((item) => (
            <WatchlistCard
              key={item.id}
              item={item}
              onRemove={() => removeItem(item.id)}
              onClose={(sellPrice: number) => {
                const pnl = (sellPrice - item.buyPrice) * item.quantity * (item.market === 'ID' ? 100 : 1);
                const pnlPercent = ((sellPrice - item.buyPrice) / item.buyPrice) * 100;
                closePosition({
                  id: `closed-${item.id}-${Date.now()}`,
                  symbol: item.symbol,
                  market: item.market,
                  name: item.name,
                  buyPrice: item.buyPrice,
                  buyDate: item.buyDate,
                  sellPrice,
                  sellDate: new Date().toISOString().split('T')[0],
                  quantity: item.quantity,
                  pnl,
                  pnlPercent,
                });
                removeItem(item.id);
              }}
              formatCurrency={formatCurrency}
            />
          ))}

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
  formatCurrency,
}: {
  item: WatchlistItem;
  onRemove: () => void;
  onClose: (sellPrice: number) => void;
  formatCurrency: (v: number, m: Market) => string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const isProfit = item.pnlPercent >= 0;

  const handleClose = () => {
    const price = parseFloat(sellPrice);
    if (!price || price <= 0) return;
    if (confirm(`Close ${item.symbol} position at ${formatCurrency(price, item.market)}?`)) {
      onClose(price);
    }
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
          </div>
          <p className="text-sm text-gray-500">{item.name}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCloseForm(!showCloseForm)}
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

      {/* Close Position Form */}
      {showCloseForm && (
        <div className="mt-3 bg-dark-800 rounded-xl p-3 border border-dark-600 animate-fade-in">
          <p className="text-xs text-gray-400 mb-2">
            Record the sale of this position to track realized P&L
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder={`Sell price (${item.market === 'ID' ? 'Rp' : '$'})`}
              className="input-field text-sm py-2 flex-1"
              min="0"
              step="any"
            />
            <button onClick={handleClose} className="btn-primary text-sm py-2 px-4">
              Sell
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5">
            Current price: {formatCurrency(item.currentPrice, item.market)}
          </p>
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
            {item.pnlPercent.toFixed(2)}%
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
          <div className="col-span-2">
            Last Updated: {new Date(item.lastUpdated).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}