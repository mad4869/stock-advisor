'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { usePortfolioStore } from '@/lib/portfolioStore';
import { useHydration } from '@/lib/useHydration';
import { PortfolioSummary } from '@/types';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart,
    Award,
    AlertTriangle,
    BarChart3,
    Calendar,
    Loader2,
    Trash2,
    History,
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';

export default function PortfolioDashboard() {
    const hydrated = useHydration();
    const { items: watchlistItems } = useWatchlistStore();
    const {
        snapshots,
        closedPositions,
        calculateSummary,
        takeSnapshot,
        clearSnapshots,
        clearClosedPositions,
    } = usePortfolioStore();

    const [timeRange, setTimeRange] = useState<7 | 30 | 90 | 365>(30);

    // Take a snapshot whenever watchlist data is refreshed
    useEffect(() => {
        if (hydrated && watchlistItems.length > 0) {
            const hasCurrentPrices = watchlistItems.some((item) => item.currentPrice > 0);
            if (hasCurrentPrices) {
                takeSnapshot(watchlistItems);
            }
        }
    }, [hydrated, watchlistItems, takeSnapshot]);

    const summary: PortfolioSummary = useMemo(() => {
        if (!hydrated) {
            return {
                totalInvested: 0,
                totalCurrentValue: 0,
                totalPnL: 0,
                totalPnLPercent: 0,
                totalRealizedPnL: 0,
                bestPerformer: null,
                worstPerformer: null,
                winRate: 0,
            };
        }
        return calculateSummary(watchlistItems);
    }, [hydrated, watchlistItems, calculateSummary]);

    const chartData = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - timeRange);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        return snapshots
            .filter((s) => s.date >= cutoffStr)
            .map((s) => ({
                date: s.date,
                displayDate: new Date(s.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                }),
                totalValue: Math.round(s.totalCurrentValue * 100) / 100,
                totalInvested: Math.round(s.totalInvested * 100) / 100,
                pnl: Math.round(s.totalPnL * 100) / 100,
                pnlPercent: Math.round(s.totalPnLPercent * 100) / 100,
            }));
    }, [snapshots, timeRange]);

    const hasMixedCurrencies = useMemo(() => {
        const markets = new Set(watchlistItems.map((i) => i.market));
        return markets.size > 1;
    }, [watchlistItems]);

    if (!hydrated) {
        return (
            <div className="card flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-3" />
                <span className="text-gray-400">Loading portfolio...</span>
            </div>
        );
    }

    const isProfit = summary.totalPnL >= 0;
    const hasData = watchlistItems.length > 0;

    return (
        <div className="space-y-6">
            {/* Currency Warning */}
            {hasMixedCurrencies && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-sm text-yellow-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                        Your portfolio has both USD and IDR positions. Totals are shown as combined
                        numeric values. For accurate accounting, consider tracking each currency
                        separately.
                    </span>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Invested */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                        <p className="text-xs text-gray-500 font-medium">Total Invested</p>
                    </div>
                    <p className="text-xl font-bold text-white">
                        {summary.totalInvested.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })}
                    </p>
                </div>

                {/* Current Value */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-purple-400" />
                        <p className="text-xs text-gray-500 font-medium">Current Value</p>
                    </div>
                    <p className="text-xl font-bold text-white">
                        {summary.totalCurrentValue.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })}
                    </p>
                </div>

                {/* Unrealized P&L */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        {isProfit ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                        <p className="text-xs text-gray-500 font-medium">Unrealized P&L</p>
                    </div>
                    <p className={`text-xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}
                        {summary.totalPnL.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })}
                    </p>
                    <p className={`text-sm ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}
                        {summary.totalPnLPercent.toFixed(2)}%
                    </p>
                </div>

                {/* Win Rate */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <PieChart className="w-4 h-4 text-yellow-400" />
                        <p className="text-xs text-gray-500 font-medium">Win Rate</p>
                    </div>
                    <p className="text-xl font-bold text-white">{summary.winRate.toFixed(0)}%</p>
                    <p className="text-sm text-gray-500">
                        {watchlistItems.filter((i) => i.pnlPercent >= 0).length} of{' '}
                        {watchlistItems.length} positions
                    </p>
                </div>
            </div>

            {/* Best / Worst + Realized P&L */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Best Performer */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 text-green-400" />
                        <p className="text-xs text-gray-500 font-medium">Best Performer</p>
                    </div>
                    {summary.bestPerformer ? (
                        <div>
                            <p className="text-lg font-bold text-white">{summary.bestPerformer.symbol}</p>
                            <p className="text-sm text-green-400">
                                +{summary.bestPerformer.pnlPercent.toFixed(2)}%
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No positions yet</p>
                    )}
                </div>

                {/* Worst Performer */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <p className="text-xs text-gray-500 font-medium">Worst Performer</p>
                    </div>
                    {summary.worstPerformer ? (
                        <div>
                            <p className="text-lg font-bold text-white">{summary.worstPerformer.symbol}</p>
                            <p className="text-sm text-red-400">
                                {summary.worstPerformer.pnlPercent.toFixed(2)}%
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No positions yet</p>
                    )}
                </div>

                {/* Realized P&L */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-blue-400" />
                        <p className="text-xs text-gray-500 font-medium">Realized P&L</p>
                    </div>
                    <p
                        className={`text-lg font-bold ${summary.totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                    >
                        {summary.totalRealizedPnL >= 0 ? '+' : ''}
                        {summary.totalRealizedPnL.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                        })}
                    </p>
                    <p className="text-xs text-gray-500">{closedPositions.length} closed trades</p>
                </div>
            </div>

            {/* P&L History Chart */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">P&L History</h3>
                    </div>

                    <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
                        {([7, 30, 90, 365] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeRange === range
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {range === 7 ? '1W' : range === 30 ? '1M' : range === 90 ? '3M' : '1Y'}
                            </button>
                        ))}
                    </div>
                </div>

                {chartData.length > 1 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a38" />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#666"
                                    fontSize={11}
                                    tickLine={false}
                                />
                                <YAxis stroke="#666" fontSize={11} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e1e28',
                                        border: '1px solid #3a3a4d',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                    }}
                                    labelStyle={{ color: '#fff' }}
                                    formatter={(value: number, name: string) => {
                                        if (name === 'pnlPercent') return [`${value.toFixed(2)}%`, 'P&L %'];
                                        return [value.toLocaleString(), name === 'pnl' ? 'P&L' : name];
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="pnl"
                                    stroke={chartData[chartData.length - 1]?.pnl >= 0 ? '#22c55e' : '#ef4444'}
                                    strokeWidth={2}
                                    fill={
                                        chartData[chartData.length - 1]?.pnl >= 0
                                            ? 'url(#pnlGradientPos)'
                                            : 'url(#pnlGradientNeg)'
                                    }
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                        <Calendar className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">
                            {chartData.length === 1
                                ? 'Need at least 2 days of data to show chart. Come back tomorrow!'
                                : 'No snapshot data yet. Add stocks to your watchlist and refresh to start tracking.'}
                        </p>
                    </div>
                )}

                {/* Snapshot count info */}
                {snapshots.length > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>
                            {snapshots.length} snapshots • First: {snapshots[0]?.date} • Latest:{' '}
                            {snapshots[snapshots.length - 1]?.date}
                        </span>
                        <button
                            onClick={() => {
                                if (confirm('Clear all P&L history? This cannot be undone.')) {
                                    clearSnapshots();
                                }
                            }}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>

            {/* Closed Positions History */}
            {closedPositions.length > 0 && (
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-bold text-white">Closed Positions</h3>
                        </div>
                        <button
                            onClick={() => {
                                if (confirm('Clear closed positions history?')) {
                                    clearClosedPositions();
                                }
                            }}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 border-b border-dark-600">
                                    <th className="text-left py-2 px-3">Symbol</th>
                                    <th className="text-right py-2 px-3">Buy</th>
                                    <th className="text-right py-2 px-3">Sell</th>
                                    <th className="text-right py-2 px-3">Qty</th>
                                    <th className="text-right py-2 px-3">P&L</th>
                                    <th className="text-right py-2 px-3">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closedPositions
                                    .slice()
                                    .reverse()
                                    .map((pos) => (
                                        <tr key={pos.id} className="border-b border-dark-700 hover:bg-dark-800">
                                            <td className="py-2.5 px-3 font-medium text-white">
                                                {pos.symbol}{' '}
                                                <span className="text-xs text-gray-500">
                                                    {pos.market === 'ID' ? '🇮🇩' : '🇺🇸'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-400">
                                                {pos.buyPrice.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-400">
                                                {pos.sellPrice.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-400">{pos.quantity}</td>
                                            <td
                                                className={`py-2.5 px-3 text-right font-medium ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                                    }`}
                                            >
                                                {pos.pnl >= 0 ? '+' : ''}
                                                {pos.pnlPercent.toFixed(2)}%
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-500">{pos.sellDate}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}