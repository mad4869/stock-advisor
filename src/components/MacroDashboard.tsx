'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Percent,
  Coins,
  RefreshCw,
  Info,
  Layers,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { MacroIndicator, MacroCategory } from '@/app/api/macro/route';

export default function MacroDashboard() {
  const [indicators, setIndicators] = useState<MacroIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MacroCategory | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMacroData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/macro');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch global market data');
      }
      setIndicators(data.indicators || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Error loading global indicators');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMacroData();
    // Refresh every 3 minutes automatically
    const interval = setInterval(() => fetchMacroData(), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const categories: { id: MacroCategory | 'all'; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'all', label: 'All Indicators', icon: <Layers className="w-4 h-4" /> },
    {
      id: 'indices',
      label: 'Global Indices',
      icon: <Globe className="w-4 h-4 text-blue-400" />,
      count: indicators.filter((i) => i.category === 'indices').length,
    },
    {
      id: 'sentiment',
      label: 'Fear & Greed (VIX)',
      icon: <Activity className="w-4 h-4 text-purple-400" />,
      count: indicators.filter((i) => i.category === 'sentiment').length,
    },
    {
      id: 'commodities',
      label: 'Commodities',
      icon: <Flame className="w-4 h-4 text-amber-400" />,
      count: indicators.filter((i) => i.category === 'commodities').length,
    },
    {
      id: 'rates',
      label: 'Rates & Currencies',
      icon: <Percent className="w-4 h-4 text-emerald-400" />,
      count: indicators.filter((i) => i.category === 'rates').length,
    },
    {
      id: 'crypto',
      label: 'Crypto & Risk Liquidity',
      icon: <Coins className="w-4 h-4 text-cyan-400" />,
      count: indicators.filter((i) => i.category === 'crypto').length,
    },
  ];

  const filteredIndicators =
    activeTab === 'all'
      ? indicators
      : indicators.filter((item) => item.category === activeTab);

  const getBadgeStyle = (color: MacroIndicator['labelColor']) => {
    switch (color) {
      case 'green':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'red':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'yellow':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'purple':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'blue':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
    }
  };

  // Find VIX for prominent Fear & Greed Banner right at the top
  const vixIndicator = indicators.find((i) => i.symbol === '^VIX');

  return (
    <div className="card border border-dark-600 bg-dark-800/80 backdrop-blur-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-600">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Global Macro & Market Conditions
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Real-time sentiment, commodities, and index gauges to assess market health before taking swing trades.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {lastUpdated && (
            <span className="text-2xs text-gray-400 font-mono">
              Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchMacroData(true)}
            disabled={loading || refreshing}
            className="p-2 bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded-lg text-gray-300 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            title="Refresh Market Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prominent VIX (Fear & Greed) Banner if loaded */}
      {vixIndicator && (
        <div className="bg-gradient-to-r from-purple-900/30 via-dark-700/50 to-blue-900/30 border border-purple-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-purple-950/20">
          <div className="flex items-start md:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Market Fear & Greed Gauge (CBOE VIX)</span>
                <span className="text-xs font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                  {vixIndicator.price} points
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    vixIndicator.changePercent >= 0 ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}
                >
                  {vixIndicator.change >= 0 ? `+${vixIndicator.change}` : vixIndicator.change} ({vixIndicator.changePercent >= 0 ? `+` : ``}{vixIndicator.changePercent}%)
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">
                <strong className="text-purple-300 font-semibold">{vixIndicator.label}</strong> — {vixIndicator.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 md:border-l md:border-dark-600 md:pl-4 text-2xs text-gray-400">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Tip:</strong> VIX &lt; 15 is greed; &gt; 25 indicates panic / potential swing buy zones.
            </span>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === cat.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                : 'bg-dark-700/60 text-gray-400 hover:text-gray-200 hover:bg-dark-700'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
            {cat.count !== undefined && cat.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-2xs ${activeTab === cat.id ? 'bg-blue-700 text-white' : 'bg-dark-600 text-gray-400'}`}>
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
          <p className="text-sm text-gray-400 font-medium">Loading global macro indicators & commodities...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm text-rose-300 font-medium">{error}</p>
          <button
            onClick={() => fetchMacroData()}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Retry Fetch
          </button>
        </div>
      ) : filteredIndicators.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          No indicators available in this category right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIndicators.map((item) => {
            const isPositive = item.change >= 0;
            return (
              <div
                key={item.symbol}
                className="bg-dark-700/50 hover:bg-dark-700/80 border border-dark-600 hover:border-dark-500 rounded-xl p-4 transition-all flex flex-col justify-between space-y-3 group"
              >
                {/* Top Row: Title & Symbol */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors leading-tight">
                      {item.name}
                    </h3>
                    <span className="text-2xs text-gray-400 font-mono tracking-wider mt-0.5 block">
                      {item.symbol} • <span className="uppercase text-gray-300">{item.unit}</span>
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1 font-mono text-xs font-bold px-2 py-1 rounded-lg border ${
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{isPositive ? `+${item.changePercent}%` : `${item.changePercent}%`}</span>
                  </div>
                </div>

                {/* Middle Row: Price & Absolute Change */}
                <div className="flex items-baseline justify-between pt-1">
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {item.price.toLocaleString(undefined, {
                      minimumFractionDigits: item.price < 10 ? 2 : item.price > 10000 ? 0 : 2,
                      maximumFractionDigits: item.price < 10 ? 3 : 2,
                    })}
                  </div>
                  <span className={`text-xs font-mono font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? `+${item.change}` : item.change} {item.unit === '%' || item.unit === 'points' || item.unit === 'index' ? '' : item.unit}
                  </span>
                </div>

                {/* Bottom Row: Interpretation Badge & Description */}
                <div className="pt-2 border-t border-dark-600/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getBadgeStyle(item.labelColor)}`}>
                      {item.label}
                    </span>
                  </div>
                  <p className="text-2xs text-gray-400 leading-relaxed line-clamp-2" title={item.description}>
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
