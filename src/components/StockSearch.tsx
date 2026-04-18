'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { Market } from '@/types';

interface SearchResult {
  symbol: string;
  name: string;
  market: Market;
}

interface StockSearchProps {
  market: Market;
  onSelect: (symbol: string, market: Market) => void;
  placeholder?: string;
}

export default function StockSearch({ market, onSelect, placeholder }: StockSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const searchStocks = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/stock?query=${encodeURIComponent(q)}&market=${market}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [market]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    setShowResults(true);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchStocks(value), 400);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.symbol);
    setShowResults(false);
    onSelect(result.symbol, result.market);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowResults(false);
      onSelect(query.trim().toUpperCase(), market);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => query && setShowResults(true)}
            placeholder={placeholder || `Search ${market === 'ID' ? 'Indonesian' : 'US'} stocks...`}
            className="input-field pl-12 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setShowResults(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {showResults && (results.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-gray-400">Searching...</span>
            </div>
          ) : (
            results.map((result, idx) => (
              <button
                key={`${result.symbol}-${idx}`}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-600 transition-colors text-left"
              >
                <div>
                  <span className="font-bold text-white">{result.symbol}</span>
                  <span className="ml-2 text-sm text-gray-400 truncate">{result.name}</span>
                </div>
                <span className="text-xs text-gray-500 bg-dark-800 px-2 py-0.5 rounded">
                  {result.market === 'ID' ? '🇮🇩 IDX' : '🇺🇸 US'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}