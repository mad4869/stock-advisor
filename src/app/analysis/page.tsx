'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Market } from '@/types';
import { AnalysisResponse } from '@/types/analysis';
import { PeerData } from '@/types/analysis';
import MarketToggle from '@/components/MarketToggle';
import StockSearch from '@/components/StockSearch';
import CompanyOverview from '@/components/analysis/CompanyOverview';
import ValuationMetrics from '@/components/analysis/ValuationMetrics';
import ProfitabilityCharts from '@/components/analysis/ProfitabilityCharts';
import GrowthCharts from '@/components/analysis/GrowthCharts';
import FinancialHealth from '@/components/analysis/FinancialHealth';
import CashFlowAnalysis from '@/components/analysis/CashFlowAnalysis';
import DividendAnalysis from '@/components/analysis/DividendAnalysis';
import RedFlagsPanel from '@/components/analysis/RedFlagsPanel';
import PeerComparison from '@/components/analysis/PeerComparison';
import { Loader2, LineChart, AlertCircle } from 'lucide-react';

function AnalysisPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [market, setMarket] = useState<Market>(
    (searchParams.get('market') as Market) || 'US'
  );
  const [symbol, setSymbol] = useState<string>(
    searchParams.get('symbol') || ''
  );
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAnalysis = useCallback(async (sym: string, mkt: Market) => {
    if (!sym) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(
        `/api/analysis?symbol=${encodeURIComponent(sym)}&market=${mkt}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load analysis');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch if symbol is in URL on mount
  useEffect(() => {
    if (symbol) fetchAnalysis(symbol, market);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (sym: string, mkt: Market) => {
    setSymbol(sym);
    setMarket(mkt);
    router.replace(`/analysis?symbol=${sym}&market=${mkt}`, { scroll: false });
    fetchAnalysis(sym, mkt);
  };

  const handleMarketChange = (mkt: Market) => {
    setMarket(mkt);
    setData(null);
    setSymbol('');
    router.replace(`/analysis?market=${mkt}`, { scroll: false });
  };

  const analysis = data?.analysis;
  const redFlags = data?.redFlags ?? [];
  const peers = data?.peers ?? [];

  // Build PeerData for the current stock
  const currentPeerData: PeerData | null = analysis
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LineChart className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Fundamental Analysis</h1>
          </div>
          <p className="text-sm text-gray-400">
            Deep dive into company financials, valuation, and quality metrics.
          </p>
        </div>
        <MarketToggle market={market} onChange={handleMarketChange} />
      </div>

      {/* Search */}
      <div className="card">
        <p className="text-xs text-gray-500 mb-3">
          Search for a stock to analyze:
        </p>
        <StockSearch
          market={market}
          onSelect={handleSelect}
          placeholder={`Search ${market === 'ID' ? 'Indonesian' : 'US'} stocks...`}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          <div className="text-center">
            <p className="text-white font-medium">Fetching comprehensive data for {symbol}…</p>
            <p className="text-sm text-gray-500 mt-1">
              This may take 5–15 seconds as we pull historical financials
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !analysis && !error && (
        <div className="card py-16 text-center">
          <LineChart className="w-14 h-14 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-500 mb-2">
            Search for a stock to begin
          </h3>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">
            Enter a ticker symbol above to view comprehensive fundamental analysis,
            including financials, valuation, health indicators, and peer comparison.
          </p>
        </div>
      )}

      {/* Dashboard Sections */}
      {analysis && !loading && (
        <div className="space-y-4 animate-fade-in">

          {/* 2H: Red Flags — always at top */}
          <RedFlagsPanel redFlags={redFlags} />

          {/* 2A: Company Overview */}
          <CompanyOverview analysis={analysis} />

          {/* 2B: Valuation Metrics */}
          <ValuationMetrics
            fundamentals={analysis.fundamentals}
            analystRating={analysis.analystRating}
          />

          {/* Two-column layout for Profitability + Growth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 2C: Profitability */}
            <ProfitabilityCharts
              financials={analysis.financials}
              currentROE={analysis.fundamentals.roe}
              currentROA={analysis.fundamentals.roa}
            />

            {/* 2D: Growth */}
            <GrowthCharts
              financials={analysis.financials}
              cashFlows={analysis.cashFlows}
              cagr={analysis.cagr}
            />
          </div>

          {/* 2E: Financial Health */}
          <FinancialHealth analysis={analysis} />

          {/* Two-column layout for Cash Flow + Dividends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 2F: Cash Flow */}
            <CashFlowAnalysis analysis={analysis} />

            {/* 2G: Dividend */}
            <DividendAnalysis
              dividend={analysis.dividend}
              cashFlows={analysis.cashFlows}
              currency={analysis.fundamentals.currency}
            />
          </div>

          {/* 2I: Peer Comparison */}
          {currentPeerData && (
            <PeerComparison
              peers={peers}
              currentSymbol={analysis.fundamentals.symbol}
              currentData={currentPeerData}
            />
          )}

          {/* Data disclaimer */}
          <p className="text-[10px] text-gray-600 text-center pb-4">
            Data sourced from Yahoo Finance. Financial statements reflect annual reports (up to 4 years).
            Cached for 30 minutes. Past performance does not guarantee future results.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    }>
      <AnalysisPageInner />
    </Suspense>
  );
}
