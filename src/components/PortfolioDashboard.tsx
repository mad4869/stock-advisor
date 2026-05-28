'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { usePortfolioStore } from '@/lib/portfolioStore';
import { useHydration } from '@/lib/useHydration';
import { Market, MarketPnL, PortfolioSummary, ClosedPosition, MarketSnapshotData, WatchlistItem, PortfolioSnapshot } from '@/types';
import { buildCombinedMonthlyStats, MonthlyStats } from '@/lib/monthlyStats';
import {
    PieChart,
    Award,
    AlertTriangle,
    BarChart3,
    Calendar,
    Loader2,
    Trash2,
    History,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// ============================================================
// Currency formatting helpers
// ============================================================

function formatUSD(value: number, showSign: boolean = false): string {
    const sign = showSign && value >= 0 ? '+' : '';
    const formatted = value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return sign + '$' + formatted;
}

function formatIDR(value: number, showSign: boolean = false): string {
    const sign = showSign && value >= 0 ? '+' : '';
    const formatted = value.toLocaleString('id-ID');
    return sign + 'Rp' + formatted;
}

function formatCurrency(value: number, market: Market, showSign: boolean = false): string {
    if (market === 'ID') return formatIDR(value, showSign);
    return formatUSD(value, showSign);
}

function emptyMarketPnLDefault(market: Market): MarketPnL {
    return {
        market,
        currency: market === 'ID' ? 'IDR' : 'USD',
        totalInvested: 0,
        totalCurrentValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        positionCount: 0,
        winnersCount: 0,
        losersCount: 0,
        winRate: 0,
        bestPerformer: null,
        worstPerformer: null,
    };
}

// ============================================================
// Safely read market data from a snapshot
// Handles both old format (flat) and new format (per-market)
// ============================================================

function getMarketDataFromSnapshot(
    snapshot: any,
    market: 'US' | 'ID'
): MarketSnapshotData {
    // New format: snapshot.us and snapshot.id exist
    if (market === 'US' && snapshot.us && typeof snapshot.us.totalCurrentValue === 'number') {
        return snapshot.us;
    }
    if (market === 'ID' && snapshot.id && typeof snapshot.id.totalCurrentValue === 'number') {
        return snapshot.id;
    }

    // Old format: flat structure — treat all data as the selected market
    return {
        totalCurrentValue: snapshot.totalCurrentValue || 0,
        totalInvested: snapshot.totalInvested || 0,
        totalPnL: snapshot.totalPnL || 0,
        totalPnLPercent: snapshot.totalPnLPercent || 0,
        positionCount: snapshot.positions?.length || 0,
    };
}

// ============================================================
// Main Component
// ============================================================

type ChartMarket = 'US' | 'ID';

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
    const [chartMarket, setChartMarket] = useState<ChartMarket>('US');

    // Note: Old-format snapshot migration is handled by portfolioStore's migrate function

    // Take snapshot when data is available
    useEffect(() => {
        if (hydrated && watchlistItems.length > 0) {
            const hasCurrentPrices = watchlistItems.some((i) => i.currentPrice > 0);
            if (hasCurrentPrices) {
                takeSnapshot(watchlistItems);
            }
        }
    }, [hydrated, watchlistItems, takeSnapshot]);

    const summary: PortfolioSummary = useMemo(() => {
        if (!hydrated) {
            return {
                us: emptyMarketPnLDefault('US'),
                id: emptyMarketPnLDefault('ID'),
                totalPositions: 0,
                totalRealizedPnL: { us: 0, id: 0 },
                overallWinRate: 0,
            };
        }
        return calculateSummary(watchlistItems);
    }, [hydrated, watchlistItems, calculateSummary]);

    // Build chart data safely
    const chartData = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - timeRange);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        return snapshots
            .filter((s) => s.date >= cutoffStr)
            .map((s) => {
                const marketData = getMarketDataFromSnapshot(s, chartMarket);

                return {
                    date: s.date,
                    displayDate: new Date(s.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                    }),
                    totalValue: Math.round(marketData.totalCurrentValue || 0),
                    totalInvested: Math.round(marketData.totalInvested || 0),
                    pnl: Math.round(marketData.totalPnL || 0),
                    pnlPercent: Math.round((marketData.totalPnLPercent || 0) * 100) / 100,
                    positions: marketData.positionCount || 0,
                };
            })
            .filter((d) => d.positions > 0);
    }, [snapshots, timeRange, chartMarket]);

    // Check which markets have positions
    const hasUSPositions = watchlistItems.some((i) => i.market === 'US');
    const hasIDPositions = watchlistItems.some((i) => i.market === 'ID');

    // Auto-select chart market
    useEffect(() => {
        if (hasUSPositions && !hasIDPositions) setChartMarket('US');
        else if (hasIDPositions && !hasUSPositions) setChartMarket('ID');
    }, [hasUSPositions, hasIDPositions]);

    // Loading state
    if (!hydrated) {
        return (
            <div className="card flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-3" />
                <span className="text-gray-400">Loading portfolio...</span>
            </div>
        );
    }

    // Calculate realized P&L per market
    const usClosedPnL = closedPositions
        .filter((p) => p.market === 'US')
        .reduce((sum, p) => sum + p.pnl, 0);
    const idClosedPnL = closedPositions
        .filter((p) => p.market === 'ID')
        .reduce((sum, p) => sum + p.pnl, 0);

    return (
        <div className="space-y-6">
            {/* Reset Button */}
            {(snapshots.length > 0 || closedPositions.length > 0) && (
                <div className="flex justify-end">
                    <button
                        onClick={() => {
                            if (confirm('Reset all portfolio data? This will clear P&L history and closed positions. This cannot be undone.')) {
                                clearSnapshots();
                                clearClosedPositions();
                            }
                        }}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-2"
                        title="Reset all portfolio data"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset Portfolio
                    </button>
                </div>
            )}

            {/* Overall Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Positions */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                        <p className="text-xs text-gray-500 font-medium">Total Positions</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{summary.totalPositions}</p>
                    <div className="flex gap-2 mt-1">
                        {hasUSPositions && (
                            <span className="text-xs text-gray-500">🇺🇸 {summary.us.positionCount}</span>
                        )}
                        {hasIDPositions && (
                            <span className="text-xs text-gray-500">🇮🇩 {summary.id.positionCount}</span>
                        )}
                    </div>
                </div>

                {/* Win Rate */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <PieChart className="w-4 h-4 text-purple-400" />
                        <p className="text-xs text-gray-500 font-medium">Win Rate</p>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {summary.overallWinRate.toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {summary.us.winnersCount + summary.id.winnersCount}W /{' '}
                        {summary.us.losersCount + summary.id.losersCount}L
                    </p>
                </div>

                {/* Realized P&L (US) */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-yellow-400" />
                        <p className="text-xs text-gray-500 font-medium">Realized P&L (US)</p>
                    </div>
                    <p
                        className={
                            'text-xl font-bold ' +
                            (usClosedPnL >= 0 ? 'text-green-400' : 'text-red-400')
                        }
                    >
                        {formatUSD(usClosedPnL, true)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {closedPositions.filter((p) => p.market === 'US').length} closed trades
                    </p>
                </div>

                {/* Realized P&L (IDX) */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-yellow-400" />
                        <p className="text-xs text-gray-500 font-medium">Realized P&L (IDX)</p>
                    </div>
                    <p
                        className={
                            'text-xl font-bold ' +
                            (idClosedPnL >= 0 ? 'text-green-400' : 'text-red-400')
                        }
                    >
                        {formatIDR(idClosedPnL, true)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {closedPositions.filter((p) => p.market === 'ID').length} closed trades
                    </p>
                </div>
            </div>

            {/* Per-Market P&L Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(hasUSPositions || summary.us.positionCount > 0) && (
                    <MarketPnLCard
                        pnl={summary.us}
                        realizedPnL={usClosedPnL}
                        closedCount={closedPositions.filter((p) => p.market === 'US').length}
                    />
                )}

                {(hasIDPositions || summary.id.positionCount > 0) && (
                    <MarketPnLCard
                        pnl={summary.id}
                        realizedPnL={idClosedPnL}
                        closedCount={closedPositions.filter((p) => p.market === 'ID').length}
                    />
                )}

                {!hasUSPositions && !hasIDPositions && (
                    <div className="lg:col-span-2 card text-center py-8">
                        <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">
                            Add stocks to your watchlist to see portfolio performance here.
                        </p>
                    </div>
                )}
            </div>

            {/* P&L History Chart */}
            <div className="card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">P&L History</h3>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Market Toggle */}
                        {hasUSPositions && hasIDPositions && (
                            <div className="flex items-center bg-dark-800 rounded-lg p-1 border border-dark-600">
                                <button
                                    onClick={() => setChartMarket('US')}
                                    className={
                                        'px-3 py-1 rounded-md text-xs font-semibold transition-all ' +
                                        (chartMarket === 'US'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-400 hover:text-white')
                                    }
                                >
                                    🇺🇸 USD
                                </button>
                                <button
                                    onClick={() => setChartMarket('ID')}
                                    className={
                                        'px-3 py-1 rounded-md text-xs font-semibold transition-all ' +
                                        (chartMarket === 'ID'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-400 hover:text-white')
                                    }
                                >
                                    🇮🇩 IDR
                                </button>
                            </div>
                        )}

                        {/* Time Range */}
                        <div className="flex items-center bg-dark-800 rounded-lg p-1 border border-dark-600">
                            {([7, 30, 90, 365] as const).map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={
                                        'px-3 py-1 rounded-md text-xs font-medium transition-all ' +
                                        (timeRange === range
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-400 hover:text-white')
                                    }
                                >
                                    {range === 7 ? '1W' : range === 30 ? '1M' : range === 90 ? '3M' : '1Y'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                    Showing {chartMarket === 'US' ? '🇺🇸 US (USD)' : '🇮🇩 IDX (IDR)'} portfolio P&L
                </p>

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
                                <XAxis dataKey="displayDate" stroke="#666" fontSize={11} tickLine={false} />
                                <YAxis
                                    stroke="#666"
                                    fontSize={11}
                                    tickLine={false}
                                    tickFormatter={(value: number) => {
                                        if (chartMarket === 'ID') {
                                            if (Math.abs(value) >= 1000000)
                                                return (value / 1000000).toFixed(1) + 'M';
                                            if (Math.abs(value) >= 1000)
                                                return (value / 1000).toFixed(0) + 'K';
                                            return value.toString();
                                        }
                                        return value.toLocaleString();
                                    }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e1e28',
                                        border: '1px solid #3a3a4d',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                    }}
                                    labelStyle={{ color: '#fff' }}
                                    formatter={(value: number, name: string) => {
                                        const prefix = chartMarket === 'ID' ? 'Rp' : '$';
                                        if (name === 'pnlPercent') return [value.toFixed(2) + '%', 'P&L %'];
                                        if (name === 'pnl') return [prefix + value.toLocaleString(), 'P&L'];
                                        if (name === 'totalValue')
                                            return [prefix + value.toLocaleString(), 'Value'];
                                        return [value.toLocaleString(), name];
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="pnl"
                                    stroke={
                                        chartData[chartData.length - 1]?.pnl >= 0 ? '#22c55e' : '#ef4444'
                                    }
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
                                ? 'Need at least 2 days of data. Come back tomorrow!'
                                : 'No ' +
                                (chartMarket === 'US' ? 'US' : 'IDX') +
                                ' snapshot data yet.'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            Visit daily to build your P&L history chart.
                        </p>
                    </div>
                )}

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

            {/* Monthly Profit Section */}
            {(closedPositions.length > 0 || watchlistItems.length > 0) && (
                <MonthlyProfitSection
                    closedPositions={closedPositions}
                    watchlistItems={watchlistItems}
                    snapshots={snapshots}
                    hasUS={
                        closedPositions.some((p) => p.market === 'US') ||
                        watchlistItems.some((i) => i.market === 'US')
                    }
                    hasID={
                        closedPositions.some((p) => p.market === 'ID') ||
                        watchlistItems.some((i) => i.market === 'ID')
                    }
                />
            )}

            {/* Closed Positions */}
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

                    {closedPositions.some((p) => p.market === 'US') && (
                        <ClosedPositionsTable
                            positions={closedPositions.filter((p) => p.market === 'US')}
                            market="US"
                        />
                    )}

                    {closedPositions.some((p) => p.market === 'ID') && (
                        <ClosedPositionsTable
                            positions={closedPositions.filter((p) => p.market === 'ID')}
                            market="ID"
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function fmtAbs(value: number, market: Market): string {
    return Math.abs(value).toLocaleString(
        market === 'ID' ? 'id-ID' : 'en-US',
        { maximumFractionDigits: market === 'ID' ? 0 : 2 }
    );
}

function MonthlyProfitSection({
    closedPositions,
    watchlistItems,
    snapshots,
    hasUS,
    hasID,
}: {
    closedPositions: ClosedPosition[];
    watchlistItems: WatchlistItem[];
    snapshots: PortfolioSnapshot[];
    hasUS: boolean;
    hasID: boolean;
}) {
    const [market, setMarket] = useState<Market>(hasUS ? 'US' : 'ID');

    const monthlyStats = useMemo(
        () => buildCombinedMonthlyStats(closedPositions, snapshots, watchlistItems, market),
        [closedPositions, snapshots, watchlistItems, market]
    );

    const totalRealized = monthlyStats.reduce((s, m) => s + m.realizedPnl, 0);
    const totalTrades   = monthlyStats.reduce((s, m) => s + m.trades, 0);
    const totalWins     = monthlyStats.reduce((s, m) => s + m.wins, 0);
    const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    // Current absolute unrealized (not sum of deltas) for the totals row
    const multiplier = market === 'ID' ? 100 : 1;
    const currentOpenItems = watchlistItems.filter((i) => i.market === market);
    const currentAbsUnrealized = currentOpenItems.reduce(
        (sum, i) => sum + (i.currentPrice - i.buyPrice) * i.quantity * multiplier,
        0
    );
    const currentOpenCount = currentOpenItems.length;

    const realizedMonths = monthlyStats.filter((m) => m.trades > 0);
    const bestMonth = realizedMonths.length > 0
        ? realizedMonths.reduce((best, m) => (m.realizedPnl > best.realizedPnl ? m : best))
        : null;
    const worstMonth = realizedMonths.length > 0
        ? realizedMonths.reduce((worst, m) => (m.realizedPnl < worst.realizedPnl ? m : worst))
        : null;

    if (monthlyStats.length === 0) return null;

    const prefix = market === 'ID' ? 'Rp' : '$';

    return (
        <div className="card">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">Monthly Profit Breakdown</h3>
                </div>
                {hasUS && hasID && (
                    <div className="flex items-center bg-dark-800 rounded-lg p-1 border border-dark-600">
                        <button
                            onClick={() => setMarket('US')}
                            className={
                                'px-3 py-1 rounded-md text-xs font-semibold transition-all ' +
                                (market === 'US' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white')
                            }
                        >
                            🇺🇸 USD
                        </button>
                        <button
                            onClick={() => setMarket('ID')}
                            className={
                                'px-3 py-1 rounded-md text-xs font-semibold transition-all ' +
                                (market === 'ID' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white')
                            }
                        >
                            🇮🇩 IDR
                        </button>
                    </div>
                )}
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total Realized</p>
                    <p className={`text-base font-bold ${totalRealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalRealized >= 0 ? '+' : ''}{prefix}{fmtAbs(totalRealized, market)}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{totalTrades} closed trade{totalTrades !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Current Unrealized</p>
                    <p className={`text-base font-bold ${currentAbsUnrealized >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                        {currentAbsUnrealized >= 0 ? '+' : ''}{prefix}{fmtAbs(currentAbsUnrealized, market)}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{currentOpenCount} open position{currentOpenCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Best Month</p>
                    {bestMonth && bestMonth.realizedPnl > 0 ? (
                        <>
                            <p className="text-base font-bold text-green-400">
                                +{prefix}{fmtAbs(bestMonth.realizedPnl, market)}
                            </p>
                            <p className="text-[10px] text-gray-500">{bestMonth.label}</p>
                        </>
                    ) : (
                        <p className="text-base font-bold text-gray-500">—</p>
                    )}
                </div>
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Worst Month</p>
                    {worstMonth && worstMonth.realizedPnl < 0 ? (
                        <>
                            <p className="text-base font-bold text-red-400">
                                -{prefix}{fmtAbs(worstMonth.realizedPnl, market)}
                            </p>
                            <p className="text-[10px] text-gray-500">{worstMonth.label}</p>
                        </>
                    ) : (
                        <p className="text-base font-bold text-gray-500">—</p>
                    )}
                </div>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
                    Realized profit
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
                    Realized loss
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-400 opacity-70" />
                    Unrealized Δ gain
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-orange-400 opacity-70" />
                    Unrealized Δ loss
                </span>
            </div>

            {/* Grouped Bar Chart */}
            {monthlyStats.length >= 1 && (
                <div className="h-56 mb-5">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats} barCategoryGap="25%" barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a38" vertical={false} />
                            <XAxis dataKey="label" stroke="#666" fontSize={11} tickLine={false} />
                            <YAxis
                                stroke="#666"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(v: number) => {
                                    if (market === 'ID') {
                                        if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
                                        if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'K';
                                        return v.toString();
                                    }
                                    if (Math.abs(v) >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'K';
                                    return '$' + v.toFixed(0);
                                }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e1e28',
                                    border: '1px solid #3a3a4d',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                }}
                                labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
                                formatter={(value: number, name: string) => {
                                    const sign = value >= 0 ? '+' : '-';
                                    const formatted = sign + prefix + fmtAbs(value, market);
                                    if (name === 'realizedPnl') return [formatted, 'Realized P&L'];
                                    if (name === 'floatingPnlDelta') return [formatted, 'Unrealized Δ'];
                                    return [value, name];
                                }}
                                cursor={{ fill: '#2a2a38' }}
                            />
                            <ReferenceLine y={0} stroke="#3a3a4d" strokeWidth={1} />
                            {/* Realized bar */}
                            <Bar dataKey="realizedPnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                                {monthlyStats.map((entry, index) => (
                                    <Cell
                                        key={`real-${index}`}
                                        fill={entry.realizedPnl >= 0 ? '#22c55e' : '#ef4444'}
                                        fillOpacity={entry.trades === 0 ? 0 : 0.9}
                                    />
                                ))}
                            </Bar>
                            {/* Unrealized delta bar */}
                            <Bar dataKey="floatingPnlDelta" radius={[3, 3, 0, 0]} maxBarSize={40}>
                                {monthlyStats.map((entry, index) => (
                                    <Cell
                                        key={`float-${index}`}
                                        fill={entry.floatingPnlDelta >= 0 ? '#60a5fa' : '#fb923c'}
                                        fillOpacity={!entry.hasFloatingData ? 0 : 0.75}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Monthly Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-500 border-b border-dark-600">
                            <th className="text-left py-2 px-3">Month</th>
                            <th className="text-right py-2 px-3">Closed</th>
                            <th className="text-right py-2 px-3">W / L</th>
                            <th className="text-right py-2 px-3">Win %</th>
                            <th className="text-right py-2 px-3">Realized P&L</th>
                            <th className="text-right py-2 px-3">Open</th>
                            <th className="text-right py-2 px-3">Unrealized Δ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...monthlyStats].reverse().map((row) => (
                            <tr key={row.month} className="border-b border-dark-700 hover:bg-dark-800 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-white">{row.label}</td>
                                <td className="py-2.5 px-3 text-right text-gray-400">
                                    {row.trades > 0 ? row.trades : <span className="text-gray-600">—</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                    {row.trades > 0 ? (
                                        <>
                                            <span className="text-green-400">{row.wins}</span>
                                            <span className="text-gray-600 mx-1">/</span>
                                            <span className="text-red-400">{row.losses}</span>
                                        </>
                                    ) : (
                                        <span className="text-gray-600">—</span>
                                    )}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-medium ${
                                    row.trades === 0 ? 'text-gray-600' : row.winRate >= 50 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {row.trades > 0 ? row.winRate.toFixed(0) + '%' : '—'}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-bold ${
                                    row.trades === 0 ? 'text-gray-600' : row.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {row.trades > 0 ? (
                                        <>{row.realizedPnl >= 0 ? '+' : '-'}{prefix}{fmtAbs(row.realizedPnl, market)}</>
                                    ) : (
                                        <span className="text-gray-600 font-normal">—</span>
                                    )}
                                </td>
                                <td className="py-2.5 px-3 text-right text-gray-400">
                                    {row.openPositions > 0 ? row.openPositions : <span className="text-gray-600">—</span>}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-semibold ${
                                    !row.hasFloatingData ? 'text-gray-600' : row.floatingPnlDelta >= 0 ? 'text-blue-400' : 'text-orange-400'
                                }`}>
                                    {row.hasFloatingData ? (
                                        <>{row.floatingPnlDelta >= 0 ? '+' : '-'}{prefix}{fmtAbs(row.floatingPnlDelta, market)}</>
                                    ) : (
                                        <span className="text-gray-600 font-normal">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t border-dark-500 bg-dark-800">
                            <td className="py-2.5 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</td>
                            <td className="py-2.5 px-3 text-right text-gray-300 font-bold">{totalTrades}</td>
                            <td className="py-2.5 px-3 text-right">
                                <span className="text-green-400 font-bold">{totalWins}</span>
                                <span className="text-gray-600 mx-1">/</span>
                                <span className="text-red-400 font-bold">{totalTrades - totalWins}</span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                                overallWinRate >= 50 ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {totalTrades > 0 ? overallWinRate.toFixed(0) + '%' : '—'}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                                totalRealized >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {totalRealized >= 0 ? '+' : '-'}{prefix}{fmtAbs(totalRealized, market)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-300 font-bold">{currentOpenCount}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                                currentAbsUnrealized >= 0 ? 'text-blue-400' : 'text-orange-400'
                            }`}>
                                {currentAbsUnrealized >= 0 ? '+' : '-'}{prefix}{fmtAbs(currentAbsUnrealized, market)}
                                <span className="block text-[9px] font-normal text-gray-600">current total</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================
// Market P&L Card
// ============================================================

function MarketPnLCard({
    pnl,
    realizedPnL,
    closedCount,
}: {
    pnl: MarketPnL;
    realizedPnL: number;
    closedCount: number;
}) {
    const isProfit = pnl.totalPnL >= 0;
    const flag = pnl.market === 'US' ? '🇺🇸' : '🇮🇩';
    const label = pnl.market === 'US' ? 'US Market' : 'Indonesian Market';

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{flag}</span>
                <div>
                    <h3 className="font-bold text-white">{label}</h3>
                    <p className="text-xs text-gray-500">
                        {pnl.positionCount} position{pnl.positionCount !== 1 ? 's' : ''} •{' '}
                        {pnl.currency}
                    </p>
                </div>
            </div>

            <div className="bg-dark-800 rounded-xl p-4 mb-4">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Unrealized P&L</p>
                        <p
                            className={
                                'text-2xl font-bold ' +
                                (isProfit ? 'text-green-400' : 'text-red-400')
                            }
                        >
                            {formatCurrency(pnl.totalPnL, pnl.market, true)}
                        </p>
                    </div>
                    <div
                        className={
                            'flex items-center gap-1 text-sm font-bold ' +
                            (isProfit ? 'text-green-400' : 'text-red-400')
                        }
                    >
                        {isProfit ? (
                            <ArrowUpRight className="w-4 h-4" />
                        ) : (
                            <ArrowDownRight className="w-4 h-4" />
                        )}
                        {isProfit ? '+' : ''}
                        {pnl.totalPnLPercent.toFixed(2)}%
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Invested</p>
                    <p className="text-sm font-bold text-white">
                        {formatCurrency(pnl.totalInvested, pnl.market)}
                    </p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Current Value</p>
                    <p className="text-sm font-bold text-white">
                        {formatCurrency(pnl.totalCurrentValue, pnl.market)}
                    </p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Win Rate</p>
                    <p className="text-sm font-bold text-white">
                        {pnl.winRate.toFixed(0)}%{' '}
                        <span className="text-xs text-gray-500 font-normal">
                            ({pnl.winnersCount}W / {pnl.losersCount}L)
                        </span>
                    </p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Realized P&L</p>
                    <p
                        className={
                            'text-sm font-bold ' +
                            (realizedPnL >= 0 ? 'text-green-400' : 'text-red-400')
                        }
                    >
                        {formatCurrency(realizedPnL, pnl.market, true)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-dark-800 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                        <Award className="w-3 h-3 text-green-400" />
                        <p className="text-xs text-gray-500">Best</p>
                    </div>
                    {pnl.bestPerformer ? (
                        <div>
                            <p className="text-sm font-bold text-white">{pnl.bestPerformer.symbol}</p>
                            <p className="text-xs text-green-400">
                                +{pnl.bestPerformer.pnlPercent.toFixed(2)}%
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600">—</p>
                    )}
                </div>
                <div className="bg-dark-800 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <p className="text-xs text-gray-500">Worst</p>
                    </div>
                    {pnl.worstPerformer ? (
                        <div>
                            <p className="text-sm font-bold text-white">{pnl.worstPerformer.symbol}</p>
                            <p className="text-xs text-red-400">
                                {pnl.worstPerformer.pnlPercent.toFixed(2)}%
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600">—</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Closed Positions Table
// ============================================================

function ClosedPositionsTable({
    positions,
    market,
}: {
    positions: ClosedPosition[];
    market: Market;
}) {
    const flag = market === 'US' ? '🇺🇸' : '🇮🇩';
    const currency = market === 'ID' ? 'IDR' : 'USD';
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-400">
                    {flag} {market === 'US' ? 'US' : 'IDX'} ({currency})
                </h4>
                <span
                    className={
                        'text-xs font-bold ' +
                        (totalPnL >= 0 ? 'text-green-400' : 'text-red-400')
                    }
                >
                    Total: {formatCurrency(totalPnL, market, true)}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-500 border-b border-dark-600">
                            <th className="text-left py-2 px-3">Symbol</th>
                            <th className="text-right py-2 px-3">Buy</th>
                            <th className="text-right py-2 px-3">SL</th>
                            <th className="text-right py-2 px-3">TP</th>
                            <th className="text-right py-2 px-3">Sell</th>
                            <th className="text-right py-2 px-3">Qty</th>
                            <th className="text-right py-2 px-3">P&L</th>
                            <th className="text-right py-2 px-3">P&L %</th>
                            <th className="text-right py-2 px-3">Plan</th>
                            <th className="text-right py-2 px-3">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions
                            .slice()
                            .reverse()
                            .map((pos) => (
                                <React.Fragment key={pos.id}>
                                    <tr className="border-b border-dark-700 hover:bg-dark-800">
                                    <td className="py-2.5 px-3 font-medium text-white">{pos.symbol}</td>
                                    <td className="py-2.5 px-3 text-right text-gray-400">
                                        {formatCurrency(pos.buyPrice, market)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-500">
                                        {pos.stopLossPrice ? formatCurrency(pos.stopLossPrice, market) : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-500">
                                        {pos.takeProfitPrice ? formatCurrency(pos.takeProfitPrice, market) : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-400">
                                        {formatCurrency(pos.sellPrice, market)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-400">
                                        {pos.quantity}
                                        {market === 'ID' ? ' lot' : ''}
                                    </td>
                                    <td
                                        className={
                                            'py-2.5 px-3 text-right font-medium ' +
                                            (pos.pnl >= 0 ? 'text-green-400' : 'text-red-400')
                                        }
                                    >
                                        {formatCurrency(pos.pnl, market, true)}
                                    </td>
                                    <td
                                        className={
                                            'py-2.5 px-3 text-right font-medium ' +
                                            (pos.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400')
                                        }
                                    >
                                        {pos.pnlPercent >= 0 ? '+' : ''}
                                        {pos.pnlPercent.toFixed(2)}%
                                    </td>
                                    <td
                                        className={
                                            'py-2.5 px-3 text-right text-xs font-semibold ' +
                                            (pos.followedPlan === false ? 'text-red-400' : 'text-green-400')
                                        }
                                        title={pos.planAnalysis || ''}
                                    >
                                        {pos.exitReason || '—'}
                                        {pos.followedPlan === false ? ' ✕' : pos.followedPlan === true ? ' ✓' : ''}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-gray-500">{pos.sellDate}</td>
                                    </tr>
                                </React.Fragment>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}