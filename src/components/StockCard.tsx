'use client';

import { StockRecommendation } from '@/types';
import SignalBadge from './SignalBadge';
import IndicatorExplainer from './IndicatorExplainer';
import { TrendingUp, TrendingDown, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface StockCardProps {
  recommendation: StockRecommendation;
}

const riskColors = {
  LOW: 'text-green-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-red-400',
};

export default function StockCard({ recommendation }: StockCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { stock, overallSignal, confidence, indicators, summary, riskLevel } = recommendation;
  const isPositive = stock.change >= 0;
  const currencySymbol = stock.currency === 'IDR' ? 'Rp' : '$';

  return (
    <div className="card-hover animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
            <span className="text-xs bg-dark-600 text-gray-400 px-2 py-0.5 rounded-full">
              {stock.market === 'ID' ? '🇮🇩 IDX' : '🇺🇸 US'}
            </span>
          </div>
          <p className="text-sm text-gray-400">{stock.name}</p>
        </div>
        <SignalBadge signal={overallSignal} size="lg" />
      </div>

      {/* Price */}
      <div className="flex items-end gap-3 mb-4">
        <span className="text-3xl font-bold text-white">
          {currencySymbol}
          {stock.price.toLocaleString(stock.currency === 'IDR' ? 'id-ID' : 'en-US', {
            minimumFractionDigits: stock.currency === 'IDR' ? 0 : 2,
            maximumFractionDigits: stock.currency === 'IDR' ? 0 : 2,
          })}
        </span>
        <span
          className={`flex items-center gap-1 text-sm font-semibold ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPositive ? '+' : ''}
          {stock.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-dark-800 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Confidence</p>
          <p className="text-lg font-bold text-blue-400">{confidence}%</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Risk</p>
          <p className={`text-lg font-bold ${riskColors[riskLevel]}`}>
            <Shield className="w-4 h-4 inline mr-1" />
            {riskLevel}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Volume</p>
          <p className="text-lg font-bold text-gray-300">
            {(stock.volume / 1_000_000).toFixed(1)}M
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-dark-800/50 rounded-xl p-4 mb-4 border border-dark-600">
        <p className="text-sm text-gray-300 leading-relaxed">{summary}</p>
      </div>

      {/* Expand Indicators */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Indicator Details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            View {indicators.length} Indicator Details
          </>
        )}
      </button>

      {/* Indicators */}
      {expanded && (
        <div className="mt-4 space-y-3 animate-slide-up">
          {indicators.map((indicator, idx) => (
            <IndicatorExplainer key={idx} indicator={indicator} />
          ))}
        </div>
      )}
    </div>
  );
}