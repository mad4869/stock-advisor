'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { usePortfolioStore } from '@/lib/portfolioStore';
import { useHydration } from '@/lib/useHydration';
import { Market, MarketPnL, PortfolioSummary, ClosedPosition, MarketSnapshotData } from '@/types';
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
            {closedPositions.length > 0 && (
                <MonthlyProfitSection
                    closedPositions={closedPositions}
                    hasUS={closedPositions.some((p) => p.market === 'US')}
                    hasID={closedPositions.some((p) => p.market === 'ID')}
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

// ============================================================
// Monthly Profit Section
// ============================================================

interface MonthlyStats {
    month: string;       // 'YYYY-MM'
    label: string;       // 'Jan 2025'
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnlPercent: number;
}

function buildMonthlyStats(positions: ClosedPosition[], market: Market): MonthlyStats[] {
    const map = new Map<string, { pnl: number; trades: number; wins: number; losses: number; pnlPercentSum: number }>();

    positions
        .filter((p) => p.market === market)
        .forEach((p) => {
            const month = p.sellDate.slice(0, 7); // 'YYYY-MM'
            const existing = map.get(month) ?? { pnl: 0, trades: 0, wins: 0, losses: 0, pnlPercentSum: 0 };
            map.set(month, {
                pnl: existing.pnl + p.pnl,
                trades: existing.trades + 1,
                wins: existing.wins + (p.pnlPercent >= 0 ? 1 : 0),
                losses: existing.losses + (p.pnlPercent < 0 ? 1 : 0),
                pnlPercentSum: existing.pnlPercentSum + p.pnlPercent,
            });
        });

    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
            month,
            label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            pnl: data.pnl,
            trades: data.trades,
            wins: data.wins,
            losses: data.losses,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            avgPnlPercent: data.trades > 0 ? data.pnlPercentSum / data.trades : 0,
        }));
}

function MonthlyProfitSection({
    closedPositions,
    hasUS,
    hasID,
}: {
    closedPositions: ClosedPosition[];
    hasUS: boolean;
    hasID: boolean;
}) {
    const [market, setMarket] = useState<Market>(hasUS ? 'US' : 'ID');

    const monthlyStats = useMemo(
        () => buildMonthlyStats(closedPositions, market),
        [closedPositions, market]
    );

    const totalPnL = monthlyStats.reduce((s, m) => s + m.pnl, 0);
    const totalTrades = monthlyStats.reduce((s, m) => s + m.trades, 0);
    const totalWins = monthlyStats.reduce((s, m) => s + m.wins, 0);
    const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const bestMonth = monthlyStats.length > 0
        ? monthlyStats.reduce((best, m) => (m.pnl > best.pnl ? m : best))
        : null;
    const worstMonth = monthlyStats.length > 0
        ? monthlyStats.reduce((worst, m) => (m.pnl < worst.pnl ? m : worst))
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
                    <p className={`text-base font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{prefix}{Math.abs(totalPnL).toLocaleString(market === 'ID' ? 'id-ID' : 'en-US', { maximumFractionDigits: market === 'ID' ? 0 : 2 })}
                    </p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Win Rate</p>
                    <p className={`text-base font-bold ${overallWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {overallWinRate.toFixed(0)}%
                        <span className="text-xs font-normal text-gray-500 ml-1">{totalWins}W/{totalTrades - totalWins}L</span>
                    </p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Best Month</p>
                    {bestMonth && bestMonth.pnl > 0 ? (
                        <>
                            <p className="text-base font-bold text-green-400">
                                +{prefix}{bestMonth.pnl.toLocaleString(market === 'ID' ? 'id-ID' : 'en-US', { maximumFractionDigits: market === 'ID' ? 0 : 2 })}
                            </p>
                            <p className="text-[10px] text-gray-500">{bestMonth.label}</p>
                        </>
                    ) : (
                        <p className="text-base font-bold text-gray-500">—</p>
                    )}
                </div>
                <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Worst Month</p>
                    {worstMonth && worstMonth.pnl < 0 ? (
                        <>
                            <p className="text-base font-bold text-red-400">
                                {prefix}{worstMonth.pnl.toLocaleString(market === 'ID' ? 'id-ID' : 'en-US', { maximumFractionDigits: market === 'ID' ? 0 : 2 })}
                            </p>
                            <p className="text-[10px] text-gray-500">{worstMonth.label}</p>
                        </>
                    ) : (
                        <p className="text-base font-bold text-gray-500">—</p>
                    )}
                </div>
            </div>

            {/* Bar Chart */}
            {monthlyStats.length >= 1 ? (
                <div className="h-52 mb-5">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats} barCategoryGap="30%">
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
                                    if (name === 'pnl') {
                                        const formatted = Math.abs(value).toLocaleString(
                                            market === 'ID' ? 'id-ID' : 'en-US',
                                            { maximumFractionDigits: market === 'ID' ? 0 : 2 }
                                        );
                                        return [
                                            (value >= 0 ? '+' : '-') + prefix + formatted,
                                            'Realized P&L',
                                        ];
                                    }
                                    return [value, name];
                                }}
                                cursor={{ fill: '#2a2a38' }}
                            />
                            <ReferenceLine y={0} stroke="#3a3a4d" strokeWidth={1} />
                            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                {monthlyStats.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'}
                                        fillOpacity={0.85}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : null}

            {/* Monthly Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-500 border-b border-dark-600">
                            <th className="text-left py-2 px-3">Month</th>
                            <th className="text-right py-2 px-3">Trades</th>
                            <th className="text-right py-2 px-3">W / L</th>
                            <th className="text-right py-2 px-3">Win Rate</th>
                            <th className="text-right py-2 px-3">Avg P&L %</th>
                            <th className="text-right py-2 px-3">Total P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...monthlyStats].reverse().map((row) => (
                            <tr key={row.month} className="border-b border-dark-700 hover:bg-dark-800 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-white">{row.label}</td>
                                <td className="py-2.5 px-3 text-right text-gray-400">{row.trades}</td>
                                <td className="py-2.5 px-3 text-right">
                                    <span className="text-green-400">{row.wins}</span>
                                    <span className="text-gray-600 mx-1">/</span>
                                    <span className="text-red-400">{row.losses}</span>
                                </td>
                                <td className={`py-2.5 px-3 text-right font-medium ${row.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                    {row.winRate.toFixed(0)}%
                                </td>
                                <td className={`py-2.5 px-3 text-right font-medium ${row.avgPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {row.avgPnlPercent >= 0 ? '+' : ''}{row.avgPnlPercent.toFixed(2)}%
                                </td>
                                <td className={`py-2.5 px-3 text-right font-bold ${row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {row.pnl >= 0 ? '+' : ''}
                                    {prefix}{Math.abs(row.pnl).toLocaleString(
                                        market === 'ID' ? 'id-ID' : 'en-US',
                                        { maximumFractionDigits: market === 'ID' ? 0 : 2 }
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
                            <td className={`py-2.5 px-3 text-right font-bold ${overallWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {overallWinRate.toFixed(0)}%
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-500">—</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalPnL >= 0 ? '+' : ''}
                                {prefix}{Math.abs(totalPnL).toLocaleString(
                                    market === 'ID' ? 'id-ID' : 'en-US',
                                    { maximumFractionDigits: market === 'ID' ? 0 : 2 }
                                )}
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