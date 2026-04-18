'use client';

import { useState, useEffect } from 'react';
import { Market, StockRecommendation } from '@/types';
import MarketToggle from '@/components/MarketToggle';
import StockSearch from '@/components/StockSearch';
import StockCard from '@/components/StockCard';
import { TrendingUp, Loader2, Sparkles, RefreshCw } from 'lucide-react';

export default function RecommendPage() {
  const [market, setMarket] = useState<Market>('US');
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>([]);
  const [searchResult, setSearchResult] = useState<StockRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecommendations = async (m: Market) => {
    setLoading(true);
    setError('');
    setRecommendations([]);

    try {
      const res = await fetch(`/api/recommend?market=${m}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (symbol: string, m: Market) => {
    setSearchLoading(true);
    setSearchResult(null);

    try {
      const res = await fetch(`/api/analyze?symbol=${symbol}&market=${m}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setSearchResult(data.recommendation);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze stock.');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(market);
  }, [market]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h1 className="text-2xl font-bold text-white">Stock Recommendations</h1>
          </div>
          <p className="text-sm text-gray-400">
            Technical analysis-based signals for popular{' '}
            {market === 'ID' ? 'Indonesian (IDX)' : 'US'} stocks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MarketToggle market={market} onChange={setMarket} />
          <button
            onClick={() => fetchRecommendations(market)}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <h3 className="text-sm font-bold text-gray-400 mb-3">
          Or analyze a specific stock
        </h3>
        <StockSearch
          market={market}
          onSelect={(s, m) => handleSearch(s, m)}
          placeholder={`Analyze any ${market === 'ID' ? 'IDX' : 'US'} stock...`}
        />
      </div>

      {/* Search Result */}
      {searchLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {searchResult && (
        <div className="animate-slide-up">
          <h3 className="text-sm font-bold text-gray-400 mb-3">Search Result</h3>
          <StockCard recommendation={searchResult} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-center">
          {error}
        </div>
      )}

      {/* Loading Recommendations */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
          <p className="text-gray-400">Analyzing {market === 'ID' ? 'IDX' : 'US'} stocks...</p>
          <p className="text-sm text-gray-600 mt-1">
            This may take a moment as we crunch data for multiple stocks
          </p>
        </div>
      )}

      {/* Recommendations Grid */}
      {!loading && recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-4">
            Top Picks — Sorted by Signal Strength
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recommendations.map((rec) => (
              <StockCard key={rec.stock.symbol} recommendation={rec} />
            ))}
          </div>
        </div>
      )}

      {!loading && recommendations.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No recommendations available. Try refreshing.</p>
        </div>
      )}
    </div>
  );
}