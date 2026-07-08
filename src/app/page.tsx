'use client';

import { useRouter } from 'next/navigation';
import StockSearch from '@/components/StockSearch';
import MacroDashboard from '@/components/MacroDashboard';
import {
  Calculator,
  Eye,
  PieChart,
  ArrowRight,
  Zap,
  Shield,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { Market } from '@/types';

export default function HomePage() {
  const router = useRouter();

  const handleSearchSelect = (symbol: string, market: Market) => {
    // Navigate to the unified detail page with market parameter
    router.push(`/stock/${symbol}?market=${market}`);
  };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">
            Swing Trading & Bandarmology Powered
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Smart Stock</span>{' '}
          <span className="text-white">Advisor</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Monitor your portfolio, discover swing setups, and manage risk — for both{' '}
          <span className="text-white font-medium">US</span> and{' '}
          <span className="text-white font-medium">Indonesian</span> markets.
        </p>

        {/* Quick Search */}
        <div className="max-w-xl mx-auto">
          <StockSearch
            onSelect={handleSearchSelect}
            placeholder="Search any US or Indonesian stock..."
          />
        </div>
      </section>

      {/* Global Macro & Market Conditions */}
      <section>
        <MacroDashboard />
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/screener" className="card-hover group">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Search className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Swing Screener</h3>
          <p className="text-sm text-gray-400 mb-4">
            Find high-probability swing trading setups based on technical indicators and volume analysis.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-blue-400 font-medium group-hover:gap-2 transition-all">
            Open Screener <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link href="/watchlist" className="card-hover group">
          <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Eye className="w-6 h-6 text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Portfolio Watchlist</h3>
          <p className="text-sm text-gray-400 mb-4">
            Track your open positions in real time with P&L calculations and automated action alerts.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-blue-400 font-medium group-hover:gap-2 transition-all">
            Manage Watchlist <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link href="/calculator" className="card-hover group">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Calculator className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Position Calculator</h3>
          <p className="text-sm text-gray-400 mb-4">
            Calculate optimal position size based on your capital and risk tolerance. Supports IDX lot system.
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-blue-400 font-medium group-hover:gap-2 transition-all">
            Open Calculator <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </section>

      {/* Market Support */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl" aria-hidden="true">🇺🇸</span>
            <div>
              <h3 className="font-bold text-white">US Market (NYSE/NASDAQ)</h3>
              <p className="text-sm text-gray-400">Trade in USD, per-share basis</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
              {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'].map((s) => (
              <button
                key={s}
                className="text-xs bg-dark-600 text-gray-300 px-2 py-1 rounded-lg hover:bg-dark-500 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                onClick={() => router.push(`/stock/${s}?market=US`)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl" aria-hidden="true">🇮🇩</span>
            <div>
              <h3 className="font-bold text-white">Indonesia (IDX)</h3>
              <p className="text-sm text-gray-400">
                Trade in IDR, lot system (100 shares/lot)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'UNVR', 'ICBP'].map((s) => (
              <button
                key={s}
                className="text-xs bg-dark-600 text-gray-300 px-2 py-1 rounded-lg hover:bg-dark-500 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                onClick={() => router.push(`/stock/${s}?market=ID`)}
              >
                {s}
              </button>
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