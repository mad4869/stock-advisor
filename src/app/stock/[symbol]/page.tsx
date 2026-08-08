'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Info, Shield, Activity } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SwingScreenerResult, StockQuote, PriceRecommendation, Market } from '@/types';
import PriceRecommendationCard from '@/components/PriceRecommendationCard';

// Fundamental Analysis Components
import { computeFundamentalScore } from '@/lib/fundamentalScorer';
import { calculateFairValue } from '@/lib/valuationCalculator';
import FairValueCard from '@/components/analysis/FairValueCard';
import CompanyOverview from '@/components/analysis/CompanyOverview';
import ValuationMetrics from '@/components/analysis/ValuationMetrics';
import ProfitabilityCharts from '@/components/analysis/ProfitabilityCharts';
import GrowthCharts from '@/components/analysis/GrowthCharts';
import FinancialHealth from '@/components/analysis/FinancialHealth';
import CashFlowAnalysis from '@/components/analysis/CashFlowAnalysis';
import DividendAnalysis from '@/components/analysis/DividendAnalysis';
import RedFlagsPanel from '@/components/analysis/RedFlagsPanel';
import PeerComparison from '@/components/analysis/PeerComparison';
import VolatilityProfile from '@/components/analysis/VolatilityProfile';

interface DetailData {
  screener: SwingScreenerResult | null;
  quote: StockQuote | null;
  profile: any | null;
  priceRecommendation: PriceRecommendation | null;
  errors: {
    screener: string | null;
    quote: string | null;
    profile: string | null;
  };
}

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const decodedSymbol = decodeURIComponent(params.symbol).toUpperCase();
  const searchParams = useSearchParams();
  const market = (searchParams.get('market') as Market) || 'US';

  const [data, setData] = useState<DetailData | null>(null);
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'technical' | 'fundamental'>('technical');

  useEffect(() => {
    async function fetchData() {
      try {
        const [resDetail, resAnalysis] = await Promise.all([
          fetch(`/api/stock/detail?symbol=${decodedSymbol}&market=${market}`),
          fetch(`/api/analysis?symbol=${decodedSymbol}&market=${market}`)
        ]);

        const jsonDetail = await resDetail.json();
        const jsonAnalysis = await resAnalysis.json();

        if (!resDetail.ok) throw new Error(jsonDetail.error || 'Failed to fetch detail data');
        setData(jsonDetail);

        if (resAnalysis.ok) {
          setAnalysisData(jsonAnalysis);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [decodedSymbol, market]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p>Loading deep analysis for {decodedSymbol}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-6 text-center max-w-xl mx-auto mt-10">
        <h3 className="text-xl font-bold mb-2">Analysis Failed</h3>
        <p>{error || 'Failed to load stock data.'}</p>
        <Link href="/" className="btn-secondary mt-6 inline-flex">Go Back</Link>
      </div>
    );
  }

  const { screener, quote, profile, priceRecommendation } = data;
  const isUp = quote?.change && quote.change >= 0;

  // Build PeerData for comparison component
  const analysis = analysisData?.analysis;
  const fundamentalScore = analysis ? computeFundamentalScore(analysis, market as Market) : null;
  const fairValueResult = analysis ? calculateFairValue(analysis, market as Market) : null;
  const currentPeerData = analysis
    ? {
        symbol: analysis.fundamentals.symbol,
        name: analysis.profile.name,
        peRatio: analysis.fundamentals.peRatio,
        pbRatio: analysis.fundamentals.pbRatio,
        roe: analysis.fundamentals.roe,
        netProfitMargin: analysis.fundamentals.netProfitMargin,
        revenueGrowth: analysis.fundamentals.revenueGrowth,
        debtToEquity: analysis.fundamentals.debtToEquity,
        dividendYield: analysis.fundamentals.dividendYield,
        marketCap: analysis.fundamentals.marketCap,
      }
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-600 pb-6">
        <div className="flex items-start gap-4">
          <button onClick={() => window.history.back()} className="mt-1 p-2 bg-dark-800 hover:bg-dark-600 rounded-lg transition-colors text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-white">{decodedSymbol}</h1>
              <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded font-semibold uppercase">
                {market === 'US' ? 'US Market' : 'IDX Market'}
              </span>
            </div>
            <h2 className="text-xl text-gray-300 font-medium">{profile?.longName || profile?.shortName || quote?.name || decodedSymbol}</h2>
            {profile && (
              <p className="text-sm text-gray-500 mt-1">
                {profile.sector} • {profile.industry}
              </p>
            )}
          </div>
        </div>

        {quote && (
          <div className="text-left md:text-right bg-dark-800 p-4 rounded-xl border border-dark-600">
            <div className="text-gray-400 text-sm mb-1">Current Price ({quote.currency})</div>
            <div className="text-3xl font-bold text-white mb-1">
              {quote.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className={`flex items-center gap-2 text-sm font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{isUp ? '+' : ''}{quote.change.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span>({isUp ? '+' : ''}{quote.changePercent}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-dark-600 pb-px gap-4">
        <button
          onClick={() => setActiveTab('technical')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'technical'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          📈 Technical Swing Analysis
        </button>
        <button
          onClick={() => setActiveTab('fundamental')}
          disabled={!analysisData}
          className={`pb-3 text-sm font-bold border-b-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === 'fundamental'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          📊 Deep Fundamental Analysis {!analysisData && '(Loading...)'}
        </button>
      </div>

      {/* Tab Contents: Technical */}
      {activeTab === 'technical' && (
        <>
          {!screener ? (
            <div className="card p-8 text-center text-gray-400">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Technical Analysis data could not be generated for this stock.</p>
              <p className="text-xs mt-2">{data.errors?.screener}</p>
            </div>
          ) : (
            <>
              {/* Top Row: Scores — Smart Money first, TA second */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Smart Money (Primary Filter) */}
                <div className="card flex flex-col justify-center items-center py-8 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 opacity-5">
                    <Shield className="w-40 h-40" />
                  </div>
                  <h3 className="text-gray-400 font-semibold mb-4 uppercase tracking-wider text-sm">Smart Money Flow</h3>
                  {screener.smartMoney ? (
                    <>
                      <div className="relative">
                        <svg className="w-32 h-32 transform -rotate-90">
                          <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-dark-600" />
                          <circle 
                            cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" 
                            strokeDasharray={377} 
                            strokeDashoffset={377 - (377 * Math.max(0, screener.smartMoney.accumulationScore)) / 100}
                            className={screener.smartMoney.accumulationScore >= 60 ? "text-green-500" : screener.smartMoney.accumulationScore >= 40 ? "text-yellow-500" : "text-red-500"} 
                          />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-white">
                          {screener.smartMoney.accumulationScore}
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm mt-4 mb-1">Accumulation Score</p>
                      <p className="text-xs mb-6">
                        <span className={screener.smartMoney.accumulationScore >= 60 ? "text-green-400" : screener.smartMoney.accumulationScore >= 40 ? "text-yellow-400" : "text-red-400"}>
                          {screener.smartMoney.signalCount}/{screener.smartMoney.totalSignals} signals bullish
                        </span>
                      </p>
                      <div className="w-full max-w-sm space-y-2">
                        {screener.smartMoney.logs.map((log: string, idx: number) => (
                          <div key={idx} className="bg-dark-800 rounded px-3 py-2 text-xs flex justify-between items-center border border-dark-600">
                            <span className="text-gray-300">{log.split(':')[0]}</span>
                            <span className={log.includes('Passed') ? 'text-green-400' : log.includes('Failed') ? 'text-red-400' : log.includes('ACCUMULATING') ? 'text-green-400' : 'text-gray-500'}>
                              {log.split(':').slice(1).join(':')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 text-center">Smart Money data unavailable</div>
                  )}
                </div>

                {/* TA Score (Secondary Confirmation) */}
                <div className="card flex flex-col justify-center items-center py-8 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 opacity-5">
                    <Activity className="w-40 h-40" />
                  </div>
                  <h3 className="text-gray-400 font-semibold mb-4 uppercase tracking-wider text-sm">Technical Swing Score</h3>
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-dark-600" />
                      <circle 
                        cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={377} 
                        strokeDashoffset={377 - (377 * Math.max(0, screener.taScore)) / 100}
                        className={screener.taScore >= 60 ? "text-green-500" : "text-yellow-500"} 
                      />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-white">
                      {Math.round(screener.taScore)}
                    </div>
                  </div>

                  {(screener.taScoreBreakdown || screener.taScoreItems) && (() => {
                    const breakdown = screener.taScoreBreakdown;
                    const items = screener.taScoreItems ?? [];
                    const categories = [
                      { key: 'trend' as const, label: 'Trend', max: 48, note: 'base 30 + bonuses', color: 'blue' },
                      { key: 'volume' as const, label: 'Volume', max: 30, note: null, color: 'purple' },
                      { key: 'momentum' as const, label: 'Momentum', max: 25, note: null, color: 'orange' },
                      { key: 'structure' as const, label: 'Structure', max: 15, note: null, color: 'teal' },
                    ];
                    const colorMap: Record<string, { bar: string; badge: string; text: string }> = {
                      blue:   { bar: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400',   text: 'text-blue-400' },
                      purple: { bar: 'bg-purple-500', badge: 'bg-purple-500/20 text-purple-400', text: 'text-purple-400' },
                      orange: { bar: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-400', text: 'text-orange-400' },
                      teal:   { bar: 'bg-teal-500',   badge: 'bg-teal-500/20 text-teal-400',   text: 'text-teal-400' },
                    };
                    return (
                      <div className="mt-5 w-full px-4 space-y-4 text-xs">
                        {categories.map(({ key, label, max, note, color }) => {
                          const score = breakdown ? (breakdown as any)[key] : null;
                          const catItems = items.filter(i => i.category === key);
                          const clr = colorMap[color];
                          const pct = score != null ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
                          return (
                            <div key={key} className="bg-dark-800 rounded-xl border border-dark-600 p-3">
                              {/* Category header with mini bar */}
                              <div className="flex items-center justify-between mb-1">
                                <div>
                                  <span className={`font-bold uppercase tracking-wider text-[10px] ${clr.text}`}>{label}</span>
                                  {note && <span className="ml-1.5 text-[9px] text-gray-600 normal-case tracking-normal">{note}</span>}
                                </div>
                                {score != null && (
                                  <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${clr.badge}`}>
                                    {score}/{max}
                                  </span>
                                )}
                              </div>
                              {score != null && (
                                <div className="h-1.5 bg-dark-600 rounded-full mb-3 overflow-hidden">
                                  <div className={`h-full ${clr.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              )}
                              {/* Per-item list */}
                              {catItems.length > 0 ? (
                                <div className="space-y-1.5">
                                  {catItems.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`shrink-0 text-[11px] ${item.passed ? 'text-green-400' : item.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                          {item.passed ? '✓' : item.points < 0 ? '✗' : '—'}
                                        </span>
                                        <span className="text-gray-300 truncate">{item.label}</span>
                                      </div>
                                      <span className={`shrink-0 font-mono font-semibold ${item.points > 0 ? 'text-green-400' : item.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                        {item.points > 0 ? `+${item.points}` : item.points === 0 ? '0' : item.points}
                                        {item.max > 0 ? `/${item.max}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-gray-600 text-[11px]">No items recorded</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {screener.signals.length === 0 ? (
                      <span className="text-gray-500 text-sm">No specific setup signals detected</span>
                    ) : (
                      screener.signals.map((sig, idx) => (
                        <span key={idx} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold border border-blue-500/30">
                          {sig}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Price Recommendation */}
              {priceRecommendation && quote && (
                <PriceRecommendationCard
                  recommendation={priceRecommendation}
                  currentPrice={quote.price}
                  currency={quote.currency}
                  market={market as 'US' | 'ID'}
                />
              )}

              {/* Detailed Indicators */}
              {screener.taData && (() => {
                const currentPrice = quote?.price ?? screener.taData.close;
                const fibLevels = screener.taData.fibonacciLevels ? [
                  { name: '23.6% Level', value: screener.taData.fibonacciLevels.fib236 },
                  { name: '38.2% Level', value: screener.taData.fibonacciLevels.fib382 },
                  { name: '50.0% Level', value: screener.taData.fibonacciLevels.fib500 },
                  { name: '61.8% Level', value: screener.taData.fibonacciLevels.fib618 },
                  { name: '78.6% Level', value: screener.taData.fibonacciLevels.fib786 },
                ] : [];
                const resistances = fibLevels.filter(l => l.value >= currentPrice).sort((a, b) => a.value - b.value);
                const supports = fibLevels.filter(l => l.value < currentPrice).sort((a, b) => b.value - a.value);
                const nearestRes = resistances.length > 0 ? resistances[0].name : null;
                const nearestSup = supports.length > 0 ? supports[0].name : null;

                return (
                  <div className="space-y-6">
                    {/* MA Alignment */}
                    <div className="card">
                      <h3 className="text-lg font-bold text-white mb-1">Moving Average Alignment</h3>
                      <p className="text-xs text-gray-500 mb-5">Price vs. each moving average — green means price is above, red means below.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* EMA block */}
                        <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Exponential MA (EMA)</p>
                          <div className="space-y-2">
                            {([
                              { label: 'EMA 20', value: screener.taData.ema20 },
                              { label: 'EMA 50', value: screener.taData.ema50 },
                              { label: 'EMA 200', value: screener.taData.ema200 },
                            ] as { label: string; value: number | null }[]).map(({ label, value }) => {
                              const above = value != null && currentPrice > value;
                              const available = value != null;
                              return (
                                <div key={label} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-400">{label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">{available ? value.toFixed(2) : '—'}</span>
                                    {available ? (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${above ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {above ? '▲ Above' : '▼ Below'}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-600">N/A</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Summary badge */}
                          {(() => {
                            const price = currentPrice;
                            const allAbove = [screener.taData.ema20, screener.taData.ema50, screener.taData.ema200].every(v => v != null && price > v);
                            const noneNull = [screener.taData.ema20, screener.taData.ema50, screener.taData.ema200].every(v => v != null);
                            if (!noneNull) return null;
                            return (
                              <div className={`mt-3 pt-3 border-t border-dark-600 text-center text-xs font-semibold ${allAbove ? 'text-green-400' : 'text-yellow-400'}`}>
                                {allAbove ? '✓ Price above all EMAs' : '✗ Not above all EMAs'}
                              </div>
                            );
                          })()}
                        </div>

                        {/* SMA block */}
                        <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Simple MA (SMA)</p>
                          <div className="space-y-2">
                            {([
                              { label: 'SMA 20', value: screener.taData.sma20 },
                              { label: 'SMA 50', value: screener.taData.sma50 },
                              { label: 'SMA 200', value: screener.taData.sma200 },
                            ] as { label: string; value: number | null }[]).map(({ label, value }) => {
                              const above = value != null && currentPrice > value;
                              const available = value != null;
                              return (
                                <div key={label} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-400">{label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">{available ? value.toFixed(2) : '—'}</span>
                                    {available ? (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${above ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {above ? '▲ Above' : '▼ Below'}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-600">N/A</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Summary badge */}
                          {(() => {
                            const price = currentPrice;
                            const allAbove = [screener.taData.sma20, screener.taData.sma50, screener.taData.sma200].every(v => v != null && price > v);
                            const noneNull = [screener.taData.sma20, screener.taData.sma50, screener.taData.sma200].every(v => v != null);
                            if (!noneNull) return null;
                            return (
                              <div className={`mt-3 pt-3 border-t border-dark-600 text-center text-xs font-semibold ${allAbove ? 'text-green-400' : 'text-yellow-400'}`}>
                                {allAbove ? '✓ Price above all SMAs' : '✗ Not above all SMAs'}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Technical Indicators Breakdown */}
                    <div className="card">
                      <h3 className="text-lg font-bold text-white mb-6">Technical Indicators Breakdown</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <MetricBox label="RSI (14)" value={screener.taData.rsi?.toFixed(2)} subtext={getRSILabel(screener.taData.rsi)} />
                        <MetricBox label="MACD Hist" value={screener.taData.macdHistogram?.toFixed(3)} subtext={getMACDLabel(screener.taData.macdHistogram)} />
                        <MetricBox label="ADX (14)" value={screener.taData.adx?.toFixed(2)} subtext={getADXLabel(screener.taData.adx)} />
                        <MetricBox label="CCI (20)" value={screener.taData.cci?.toFixed(2)} subtext={getCCILabel(screener.taData.cci)} />

                        <MetricBox label="Bollinger %B" value={screener.taData.bollingerB?.toFixed(2)} subtext={getBBLabel(screener.taData.bollingerB)} />
                        <MetricBox label="ATR %" value={screener.taData.atrPercent ? `${screener.taData.atrPercent.toFixed(2)}%` : '-'} subtext={getATRLabel(screener.taData.atrPercent)} />
                        <MetricBox label="Vol Ratio (20d)" value={screener.taData.volumeRatio ? `${screener.taData.volumeRatio.toFixed(2)}x` : '-'} subtext={getVolLabel(screener.taData.volumeRatio)} />
                        <MetricBox label="MFI (14)" value={screener.taData.mfi?.toFixed(2)} subtext={getRSILabel(screener.taData.mfi)} />

                        {/* NEW Indicators */}
                        <MetricBox 
                          label="VWAP (20d)" 
                          value={screener.taData.vwap?.toFixed(2)} 
                          subtext={screener.taData.vwap != null ? (currentPrice > screener.taData.vwap ? { text: 'Bullish (Above)', color: 'text-green-400' } : { text: 'Bearish (Below)', color: 'text-red-400' }) : undefined}
                        />
                        <MetricBox label="Williams %R (14)" value={screener.taData.williamsR?.toFixed(2)} subtext={getWilliamsRLabel(screener.taData.williamsR)} />
                        <MetricBox 
                          label="Parabolic SAR" 
                          value={screener.taData.psar?.toFixed(2)} 
                          subtext={screener.taData.psar && currentPrice > screener.taData.psar ? { text: 'Bullish (Above)', color: 'text-green-400' } : { text: 'Bearish (Below)', color: 'text-red-400' }} 
                        />
                        <MetricBox 
                          label="ADX Directional" 
                          value={screener.taData.plusDi != null && screener.taData.minusDi != null ? `+DI ${screener.taData.plusDi.toFixed(1)} / -DI ${screener.taData.minusDi.toFixed(1)}` : '-'} 
                          subtext={screener.taData.plusDi != null && screener.taData.minusDi != null ? (screener.taData.plusDi > screener.taData.minusDi ? { text: 'Bullish (+DI > -DI)', color: 'text-green-400' } : { text: 'Bearish (-DI > +DI)', color: 'text-red-400' }) : undefined} 
                        />
                        <MetricBox 
                          label="Ichimoku Conversion" 
                          value={screener.taData.tenkanSen != null ? `Tenkan: ${screener.taData.tenkanSen.toFixed(2)}` : '-'} 
                          subtext={screener.taData.tenkanSen != null && screener.taData.kijunSen != null ? (screener.taData.tenkanSen > screener.taData.kijunSen ? { text: 'Bullish > Kijun', color: 'text-green-400' } : { text: 'Bearish < Kijun', color: 'text-red-400' }) : undefined}
                        />
                        <MetricBox 
                          label="Ichimoku Base" 
                          value={screener.taData.kijunSen != null ? `Kijun: ${screener.taData.kijunSen.toFixed(2)}` : '-'} 
                        />
                        <MetricBox 
                          label="Ichimoku Span A" 
                          value={screener.taData.senkouSpanA != null ? `Span A: ${screener.taData.senkouSpanA.toFixed(2)}` : '-'} 
                          subtext={screener.taData.senkouSpanA != null && screener.taData.senkouSpanB != null ? (screener.taData.senkouSpanA > screener.taData.senkouSpanB ? { text: 'Bullish Cloud', color: 'text-green-400' } : { text: 'Bearish Cloud', color: 'text-red-400' }) : undefined}
                        />
                        <MetricBox 
                          label="Ichimoku Span B" 
                          value={screener.taData.senkouSpanB != null ? `Span B: ${screener.taData.senkouSpanB.toFixed(2)}` : '-'} 
                        />
                      </div>
                    </div>

                    {/* Fibonacci Retracement Levels */}
                    {screener.taData.fibonacciLevels && (
                      <div className="card">
                        <h3 className="text-lg font-bold text-white mb-2">Fibonacci Retracement Levels (52W)</h3>
                        <p className="text-xs text-gray-500 mb-3">Levels based on 52-week High ({market === 'ID' ? 'Rp' : '$'}{screener.taData.fibonacciLevels.high.toLocaleString()}) and 52-week Low ({market === 'ID' ? 'Rp' : '$'}{screener.taData.fibonacciLevels.low.toLocaleString()}).</p>
                        
                        <p className="text-xs text-gray-400 mb-4 bg-dark-800 p-3 rounded-lg border border-dark-600 leading-relaxed">
                          💡 <strong>How to use:</strong> Fibonacci retracement levels act as key support and resistance areas. 
                          When the stock is in an uptrend, pullbacks to support levels (especially 38.2%, 50.0%, and 61.8%) 
                          often act as high-probability buy zones. Resistance levels represent potential targets or sell zones.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                          {fibLevels.map((lvl) => {
                            const dist = Math.abs((currentPrice - lvl.value) / lvl.value) * 100;
                            const isClosest = dist < 2; // within 2%
                            const isSupport = currentPrice > lvl.value;
                            const isNearestRes = lvl.name === nearestRes;
                            const isNearestSup = lvl.name === nearestSup;
                            return (
                              <div key={lvl.name} className={`p-3 rounded-lg border transition-all ${isClosest ? 'bg-blue-600/10 border-blue-500 text-blue-300 font-bold' : isNearestRes ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300' : isNearestSup ? 'bg-green-500/10 border-green-500/50 text-green-300' : 'bg-dark-800 border-dark-600 text-gray-300'}`}>
                                <div className="text-gray-500 mb-1">{lvl.name}</div>
                                <div className="text-sm text-white mb-1">
                                  {market === 'ID' ? 'Rp' : '$'}{lvl.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                                <div className={`text-[10px] font-semibold uppercase mt-1 ${isSupport ? 'text-green-400' : 'text-red-400'}`}>
                                  {isSupport ? 'Support' : 'Resistance'}
                                </div>
                                {isClosest ? (
                                  <div className="text-[9px] text-blue-400 font-bold uppercase mt-0.5">★ Testing Level</div>
                                ) : isNearestRes ? (
                                  <div className="text-[9px] text-yellow-400 font-bold uppercase mt-0.5">★ Next Resistance</div>
                                ) : isNearestSup ? (
                                  <div className="text-[9px] text-green-400 font-bold uppercase mt-0.5">★ Nearest Support</div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Volatility Profile */}
                    <div className="mt-6">
                      <VolatilityProfile
                        fundamentalsBeta={analysisData?.analysis?.fundamentals?.beta ?? data?.profile?.beta ?? null}
                        taData={screener.taData}
                        market={market as Market}
                      />
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* Tab Contents: Fundamental */}
      {activeTab === 'fundamental' && analysisData && (
        <div className="space-y-6">
          {fundamentalScore && (
            <div className="card border-blue-500/30 bg-blue-900/10">
              <h3 className="text-xl font-bold text-white flex items-center">
                <span className={`px-3 py-1 rounded-full text-sm mr-3 font-bold ${
                  fundamentalScore.grade === 'A' ? 'bg-green-500 text-white' :
                  fundamentalScore.grade === 'B' ? 'bg-emerald-500 text-white' :
                  fundamentalScore.grade === 'C' ? 'bg-yellow-500 text-black' :
                  fundamentalScore.grade === 'D' ? 'bg-orange-500 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {fundamentalScore.grade}
                </span>
                Fundamental Quality Score: {fundamentalScore.total} / 100
              </h3>
              <p className="text-sm text-blue-200 mt-2">
                A quantitative assessment of valuation, growth, profitability, health, cash flow, and analyst sentiment.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4 text-center text-xs">
                <div className="bg-dark-800 p-3 rounded-xl border border-dark-600 flex flex-col justify-center"><span className="block text-gray-400 mb-1">Valuation</span><span className="font-bold text-white text-lg">{fundamentalScore.valuation}/20</span></div>
                <div className="bg-dark-800 p-3 rounded-xl border border-dark-600 flex flex-col justify-center"><span className="block text-gray-400 mb-1">Growth</span><span className="font-bold text-white text-lg">{fundamentalScore.growth}/20</span></div>
                <div className="bg-dark-800 p-3 rounded-xl border border-dark-600 flex flex-col justify-center"><span className="block text-gray-400 mb-1">Profitability</span><span className="font-bold text-white text-lg">{fundamentalScore.profitability}/15</span></div>
                <div className="bg-dark-800 p-3 rounded-xl border border-dark-600 flex flex-col justify-center"><span className="block text-gray-400 mb-1">Health</span><span className="font-bold text-white text-lg">{fundamentalScore.health}/15</span></div>
                <div className="bg-dark-800 p-3 rounded-xl border border-dark-600 flex flex-col justify-center"><span className="block text-gray-400 mb-1">Cash Flow</span><span className="font-bold text-white text-lg">{fundamentalScore.cashFlow}/15</span></div>
                <div className="bg-dark-800 p-3 rounded-xl border border-dark-600 flex flex-col justify-center"><span className="block text-gray-400 mb-1">Analyst</span><span className="font-bold text-white text-lg">{fundamentalScore.analyst}/15</span></div>
              </div>
            </div>
          )}
          <CompanyOverview analysis={analysisData.analysis} />
          
          {fairValueResult && (
            <FairValueCard fairValue={fairValueResult} market={market as Market} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ValuationMetrics fundamentals={analysisData.analysis.fundamentals} analystRating={analysisData.analysis.analystRating} />
            <FinancialHealth analysis={analysisData.analysis} />
          </div>

          <GrowthCharts
            financials={analysisData.analysis.financials}
            cashFlows={analysisData.analysis.cashFlows}
            cagr={analysisData.analysis.cagr}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProfitabilityCharts
              financials={analysisData.analysis.financials}
              currentROE={analysisData.analysis.fundamentals.roe}
              currentROA={analysisData.analysis.fundamentals.roa}
            />
            <CashFlowAnalysis analysis={analysisData.analysis} />
          </div>

          {analysisData.peers && analysisData.peers.length > 0 && currentPeerData && (
            <PeerComparison peers={analysisData.peers} currentSymbol={decodedSymbol} currentData={currentPeerData} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DividendAnalysis
              dividend={analysisData.analysis.dividend}
              cashFlows={analysisData.analysis.cashFlows}
              currency={analysisData.analysis.fundamentals.currency}
            />
            <RedFlagsPanel redFlags={analysisData.redFlags} />
          </div>
        </div>
      )}

      {profile?.longBusinessSummary && activeTab === 'technical' && (
        <div className="card">
          <h3 className="text-lg font-bold text-white mb-4">About {profile.shortName || decodedSymbol}</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            {profile.longBusinessSummary}
          </p>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, color = "text-white", subtext }: { label: string, value: string | undefined | null, color?: string, subtext?: { text: string; color: string } }) {
  return (
    <div className="bg-dark-800 p-4 rounded-xl border border-dark-600 flex flex-col justify-between">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>
        {value !== undefined && value !== null ? value : '-'}
      </div>
      {subtext && <div className={`text-[10px] mt-1 uppercase font-semibold ${subtext.color}`}>{subtext.text}</div>}
    </div>
  );
}

// Helpers for interpreting metrics
function getRSILabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  if (val < 30) return { text: 'Oversold', color: 'text-green-400' };
  if (val > 70) return { text: 'Overbought', color: 'text-red-400' };
  return { text: 'Neutral', color: 'text-gray-400' };
}

// Helper for Williams %R interpretation
function getWilliamsRLabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  if (val <= -80) return { text: 'Oversold', color: 'text-green-400' };
  if (val >= -20) return { text: 'Overbought', color: 'text-red-400' };
  return { text: 'Neutral', color: 'text-gray-400' };
}

function getMACDLabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  return val > 0 ? { text: 'Bullish', color: 'text-green-400' } : { text: 'Bearish', color: 'text-red-400' };
}

function getADXLabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  return val > 25 ? { text: 'Strong Trend', color: 'text-green-400' } : { text: 'Weak Trend', color: 'text-gray-400' };
}

function getCCILabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  if (val > 100) return { text: 'Overbought', color: 'text-red-400' };
  if (val < -100) return { text: 'Oversold', color: 'text-green-400' };
  return { text: 'Neutral', color: 'text-gray-400' };
}

function getBBLabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  if (val > 1) return { text: 'Above Upper Band', color: 'text-red-400' };
  if (val < 0) return { text: 'Below Lower Band', color: 'text-green-400' };
  return { text: 'Inside Bands', color: 'text-gray-400' };
}

function getATRLabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  return val > 4 ? { text: 'High Volatility', color: 'text-yellow-400' } : { text: 'Normal Volatility', color: 'text-gray-400' };
}

function getVolLabel(val: number | null | undefined): { text: string; color: string } | undefined {
  if (val == null) return undefined;
  if (val > 2) return { text: 'Very High', color: 'text-green-400' };
  if (val > 1.2) return { text: 'High', color: 'text-green-400' };
  return { text: 'Normal', color: 'text-gray-400' };
}
