'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useUserPreferencesStore } from '@/lib/userPreferencesStore';
import { FCDSTStepper } from '@/components/fcdst/FCDSTStepper';
import { FCDSTFlatView } from '@/components/fcdst/FCDSTFlatView';
import { FundamentalData } from '@/types/screener';
import { TechnicalData } from '@/types/fcdst';
import { ArrowLeft, Loader2, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';

export default function AnalyzePage() {
  const params = useParams();
  const symbol = params?.symbol as string;
  const router = useRouter();
  
  const { analysisMode, toggleAnalysisMode } = useUserPreferencesStore();
  
  const [fundamentalData, setFundamentalData] = useState<FundamentalData | null>(null);
  const [technicalData, setTechnicalData] = useState<TechnicalData | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    
    async function fetchData() {
      try {
        setLoading(true);
        // Determine market from symbol (.JK = ID, else US)
        const market = symbol.endsWith('.JK') ? 'ID' : 'US';
        
        // Use screener API to fetch fundamental data specifically for this symbol
        const res = await fetch('/api/screener', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            market,
            filters: {}, // No filters, we just want the symbol data
            additionalSymbols: [symbol]
          }),
        });

        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch fundamental data');
        
        const result = data.results?.find((r: any) => r.stock.symbol === symbol);
        if (!result) throw new Error('Stock not found');
        
        setFundamentalData(result.stock);

        // Fetch technical data using score API
        try {
          const techRes = await fetch(`/api/score?symbol=${symbol}&market=${market}`);
          if (techRes.ok) {
            const techData = await techRes.json();
            if (techData?.score?.indicators) {
              setTechnicalData({
                price: techData.score.currentPrice || 0,
                ma20: techData.score.indicators.sma20,
                rsi14: techData.score.indicators.rsi14,
                volume: 0, // Fallback if unavailable
                volume20dAvg: 0, 
                fairValue: techData.score.intrinsicValue || 0,
              });
            }
          }
        } catch (techErr) {
          console.warn('Technical data unavailable', techErr);
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred fetching data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-400" />
        <p>Loading FCDS-T analysis for {symbol}...</p>
      </div>
    );
  }

  if (error || !fundamentalData) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Screener
        </button>
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-6 flex flex-col items-center text-center">
          <AlertCircle className="w-12 h-12 mb-4" />
          <h2 className="text-xl font-bold mb-2">Analysis Unavailable</h2>
          <p>{error || 'Stock not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sticky top-16 bg-dark-950/80 backdrop-blur-md py-4 z-30 border-b border-dark-600">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-medium">Mode:</span>
          <button 
            onClick={toggleAnalysisMode}
            className="flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-full px-3 py-1.5 hover:border-dark-500 transition-colors"
          >
            <span className={`text-xs font-bold ${analysisMode === 'guided' ? 'text-blue-400' : 'text-gray-500'}`}>Guided</span>
            {analysisMode === 'guided' ? (
              <ToggleLeft className="w-6 h-6 text-blue-500" />
            ) : (
              <ToggleRight className="w-6 h-6 text-blue-500" />
            )}
            <span className={`text-xs font-bold ${analysisMode === 'advanced' ? 'text-blue-400' : 'text-gray-500'}`}>Advanced</span>
          </button>
        </div>
      </div>

      {analysisMode === 'guided' ? (
        <FCDSTStepper symbol={symbol} fundamentalData={fundamentalData} technicalData={technicalData} />
      ) : (
        <FCDSTFlatView symbol={symbol} fundamentalData={fundamentalData} technicalData={technicalData} />
      )}
    </div>
  );
}
