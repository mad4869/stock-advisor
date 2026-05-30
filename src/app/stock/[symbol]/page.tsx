'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Info, Shield, Activity } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SwingScreenerResult } from '@/types';
import { StockQuote } from '@/types';

interface DetailData {
  screener: SwingScreenerResult | null;
  quote: StockQuote | null;
  profile: any | null;
  errors: {
    screener: string | null;
    quote: string | null;
    profile: string | null;
  };
}

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const decodedSymbol = decodeURIComponent(params.symbol).toUpperCase();
  const searchParams = useSearchParams();
  const market = searchParams.get('market') || 'US';

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/stock/detail?symbol=${decodedSymbol}&market=${market}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch');
        setData(json);
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

  const { screener, quote, profile } = data;
  const isUp = quote?.change && quote.change >= 0;

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

          {/* Bottom Row: Detailed Indicators */}
          {screener.taData && (
            <div className="card">
              <h3 className="text-lg font-bold text-white mb-6">Technical Indicators Breakdown</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricBox label="RSI (14)" value={screener.taData.rsi?.toFixed(2)} subtext={getRSILabel(screener.taData.rsi)} />
                <MetricBox label="MACD Hist" value={screener.taData.macdHistogram?.toFixed(3)} subtext={getMACDLabel(screener.taData.macdHistogram)} />
                <MetricBox label="ADX (14)" value={screener.taData.adx?.toFixed(2)} subtext={getADXLabel(screener.taData.adx)} />
                <MetricBox label="CCI (20)" value={screener.taData.cci?.toFixed(2)} subtext={getCCILabel(screener.taData.cci)} />

                <MetricBox label="EMA 20" value={screener.taData.ema20?.toFixed(2)} />
                <MetricBox label="EMA 50" value={screener.taData.ema50?.toFixed(2)} />
                <MetricBox label="EMA 200" value={screener.taData.ema200?.toFixed(2)} />
                <MetricBox 
                  label="Supertrend" 
                  value={screener.taData.supertrendBullish === true ? 'Bullish' : screener.taData.supertrendBullish === false ? 'Bearish' : '-'} 
                  color={screener.taData.supertrendBullish ? 'text-green-400' : 'text-red-400'}
                />

                <MetricBox label="Bollinger %B" value={screener.taData.bollingerB?.toFixed(2)} subtext={getBBLabel(screener.taData.bollingerB)} />
                <MetricBox label="ATR %" value={screener.taData.atrPercent ? `${screener.taData.atrPercent.toFixed(2)}%` : '-'} subtext={getATRLabel(screener.taData.atrPercent)} />
                <MetricBox label="Vol Ratio (20d)" value={screener.taData.volumeRatio ? `${screener.taData.volumeRatio.toFixed(2)}x` : '-'} subtext={getVolLabel(screener.taData.volumeRatio)} />
                <MetricBox label="MFI (14)" value={screener.taData.mfi?.toFixed(2)} subtext={getRSILabel(screener.taData.mfi)} />
              </div>
            </div>
          )}
        </>
      )}

      {profile?.longBusinessSummary && (
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
