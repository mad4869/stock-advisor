'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Market } from '@/types';
import { CompositeScore } from '@/types/scoring';

import StockSearch from '@/components/StockSearch';
import MarketToggle from '@/components/MarketToggle';
import ScoreGauge from '@/components/score/ScoreGauge';
import ScoreBreakdown from '@/components/score/ScoreBreakdown';
import ScoreDetails from '@/components/score/ScoreDetails';
import { Target, Loader2, AlertCircle, Bot } from 'lucide-react';

function ScorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const market = (searchParams.get('market') as Market) || 'US';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompositeScore | null>(null);

  useEffect(() => {
    async function fetchScore() {
      if (!symbol) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/score?symbol=${symbol}&market=${market}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to compute unified score');
        }
        const json = await res.json();
        setData(json.score);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchScore();
  }, [symbol, market]);

  const handleSearch = (s: string, m: Market) => {
    router.push(`/score?symbol=${s}&market=${m}`);
  };

  const handleMarketChange = (mkt: Market) => {
    if (symbol) {
      router.push(`/score?symbol=${symbol}&market=${mkt}`);
    } else {
      router.push(`/score?market=${mkt}`);
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-blue-500" />
            Unified Rating
          </h1>
          <p className="text-gray-400 mt-2">
            Composite score derived from Technical, Fundamental, and DCF Valuation models.
          </p>
        </div>
        
        <div className="w-full md:w-auto flex flex-col md:flex-row items-end md:items-center gap-4">
          <MarketToggle market={market} onChange={handleMarketChange} />
          <div className="w-full md:w-80">
            <StockSearch onSelect={handleSearch} market={market} placeholder="Search to get rating..." />
          </div>
        </div>
      </header>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
          <p>Running comprehensive scoring models for {symbol}…</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Error Loading Data</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {!symbol && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500 border border-dashed border-white/10 rounded-xl">
          <Target className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">Search for a stock to generate its unified rating.</p>
        </div>
      )}

      {/* Main Content */}
      {symbol && data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Gauge and Summary */}
          <div className="lg:col-span-5 space-y-6">
            <ScoreGauge score={data.totalScore} recommendation={data.recommendation} />
            
            {/* AI Summary Panel */}
            <div className="card bg-blue-900/10 border-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Bot className="w-16 h-16 text-blue-400" />
              </div>
              <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Summary
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed relative z-10">
                {data.summary}
              </p>
            </div>
          </div>

          {/* Right Column: Breakdown and Details */}
          <div className="lg:col-span-7 space-y-6">
            <ScoreBreakdown score={data} />
            <ScoreDetails score={data} />
          </div>

        </div>
      )}
    </main>
  );
}

export default function ScorePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ScorePageContent />
    </React.Suspense>
  );
}
