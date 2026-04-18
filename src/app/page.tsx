'use client';

import { useState } from 'react';
import { Market, StockRecommendation } from '@/types';
import MarketToggle from '@/components/MarketToggle';
import StockSearch from '@/components/StockSearch';
import StockCard from '@/components/StockCard';
import {
  TrendingUp,
  Search,
  Calculator,
  Eye,
  BarChart3,
  ArrowRight,
  Loader2,
  Zap,
  Globe,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const [market, setMarket] = useState<Market>('US');
  const [recommendation, setRecommendation] = useState<StockRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async (symbol: string, selectedMarket: Market) => {
    setLoading(true);
    setError('');
    setRecommendation(null);

    try {
      const res = await fetch(`/api/analyze?symbol=${symbol}&market=${selectedMarket}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setRecommendation(data.recommendation);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">
            Technical Analysis Powered
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Smart Stock</span>{' '}
          <span className="text-white">Advisor</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Get data-driven stock recommendations with clear explanations, calculate your ideal
          position size, and monitor your portfolio — for both{' '}
          <span className="text-white font-medium">US</span> and{' '}
          <span className="text-white font-medium">Indonesian</span> markets.
        </p>

        {/* Quick Analyze */}
        <div className="max-w-xl mx-auto space-y-4">
          <MarketToggle market={market} onChange={setMarket} />
          <StockSearch
            market={market}
            onSelect={(symbol, m) => handleAnalyze(symbol, m)}
            placeholder={`Quick analyze: Search ${market === 'ID' ? 'IDX' : 'US'} stocks...`}
          />
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
          <p className="text-gray-400">Analyzing technical indicators...</p>
          <p className="text-sm text-gray-600 mt-1">
            Calculating RSI, MACD, Bollinger Bands, and more
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-xl mx-auto bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-center">
          {error}
        </div>
      )}

      {/* Quick Analysis Result */}
      {recommendation && (
        <div className="max-w-2xl mx-auto animate-slide-up">
          <StockCard recommendation={recommendation} />
        </div>
      )}

      {/* Feature Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/recommend" className="card-hover group">
          <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Stock Recommendations</h3>
          <p className="text-sm text-gray-400 mb-4">
            Get buy/sell/hold recommendations based on 7+ technical indicators with clear
            explanations for each signal.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-blue-400 font-medium group-hover:gap-2 transition-all">
            View Recommendations <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link href="/calculator" className="card-hover group">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Calculator className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Lot Size Calculator</h3>
          <p className="text-sm text-gray-400 mb-4">
            Calculate optimal position size based on your capital. Supports Indonesian lot system
            (100 shares/lot) and US shares.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-blue-400 font-medium group-hover:gap-2 transition-all">
            Open Calculator <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link href="/watchlist" className="card-hover group">
          <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Eye className="w-6 h-6 text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Portfolio Watchlist</h3>
          <p className="text-sm text-gray-400 mb-4">
            Track your bought stocks in real time with P&L calculations and automated action
            recommendations.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-blue-400 font-medium group-hover:gap-2 transition-all">
            Manage Watchlist <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </section>

      {/* How It Works */}
      <section className="card">
        <h2 className="text-xl font-bold text-white mb-6 text-center">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">
              1
            </div>
            <h3 className="font-bold text-white mb-2">Analyze</h3>
            <p className="text-sm text-gray-400">
              We fetch real-time and historical data, then calculate 7+ technical indicators
              including RSI, MACD, Bollinger Bands, Stochastic, ADX, OBV, and Moving Averages.
            </p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">
              2
            </div>
            <h3 className="font-bold text-white mb-2">Recommend</h3>
            <p className="text-sm text-gray-400">
              Each indicator generates a signal (Buy/Sell/Hold). We aggregate them with weighted
              scoring to give you a clear, overall recommendation with confidence level.
            </p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">
              3
            </div>
            <h3 className="font-bold text-white mb-2">Monitor</h3>
            <p className="text-sm text-gray-400">
              Add your purchases to the watchlist. We continuously monitor price changes, P&L,
              and technical signals to advise when to hold, take profit, or cut losses.
            </p>
          </div>
        </div>
      </section>

      {/* Market Support */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🇺🇸</span>
            <div>
              <h3 className="font-bold text-white">US Market (NYSE/NASDAQ)</h3>
              <p className="text-sm text-gray-400">Trade in USD, per-share basis</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'].map((s) => (
              <span
                key={s}
                className="text-xs bg-dark-600 text-gray-300 px-2 py-1 rounded-lg cursor-pointer hover:bg-dark-500 transition-colors"
                onClick={() => handleAnalyze(s, 'US')}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🇮🇩</span>
            <div>
              <h3 className="font-bold text-white">Indonesia (IDX)</h3>
              <p className="text-sm text-gray-400">
                Trade in IDR, lot system (100 shares/lot)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'UNVR', 'ICBP'].map((s) => (
              <span
                key={s}
                className="text-xs bg-dark-600 text-gray-300 px-2 py-1 rounded-lg cursor-pointer hover:bg-dark-500 transition-colors"
                onClick={() => handleAnalyze(s, 'ID')}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="text-center py-6 border-t border-dark-600">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-500">Disclaimer</span>
        </div>
        <p className="text-xs text-gray-600 max-w-2xl mx-auto">
          This app provides technical analysis-based recommendations for educational purposes only.
          It is NOT financial advice. Always do your own research (DYOR) and consult with a
          licensed financial advisor before making investment decisions. Past performance does not
          guarantee future results. Investing in stocks involves risk, including the possible loss
          of principal.
        </p>
      </section>
    </div>
  );
}