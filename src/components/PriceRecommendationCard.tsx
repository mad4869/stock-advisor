'use client';

import React, { useState } from 'react';
import { Target, ShieldAlert, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';
import { PriceRecommendation } from '@/lib/priceRecommendation';

interface Props {
  recommendation: PriceRecommendation;
  currentPrice: number;
  currency: string;
  market: 'US' | 'ID';
}

export default function PriceRecommendationCard({ recommendation, currentPrice, currency, market }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const rec = recommendation;

  const formatPrice = (price: number) => {
    if (market === 'ID') {
      return price.toLocaleString('id-ID', { minimumFractionDigits: 0 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Compute positions for the price ladder visualization
  const allPrices = [rec.stopLoss, rec.entryPrice, rec.takeProfitConservative, rec.takeProfitAggressive];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice || 1;

  const getPosition = (price: number) => {
    return ((price - minPrice) / range) * 100;
  };

  const confidenceConfig = {
    HIGH: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    MEDIUM: { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
    LOW: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', glow: 'shadow-red-500/20' },
  };
  const conf = confidenceConfig[rec.confidence];

  return (
    <div className="card relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Price Recommendation</h3>
            <p className="text-xs text-gray-500">ATR-based swing trade levels</p>
          </div>
        </div>

        {/* Confidence Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${conf.bg} ${conf.border} ${conf.text} border shadow-lg ${conf.glow}`}>
          <div className={`w-2 h-2 rounded-full ${rec.confidence === 'HIGH' ? 'bg-emerald-400' : rec.confidence === 'MEDIUM' ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} />
          {rec.confidence} Confidence
        </div>
      </div>

      {/* ─── Price Level Cards ─── */}
      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Stop Loss */}
        <div className="group relative bg-dark-800 rounded-xl border border-red-500/20 p-4 hover:border-red-500/40 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Stop Loss</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatPrice(rec.stopLoss)}
          </div>
          <div className="text-xs text-red-400/80">
            −{rec.stopLossPercent.toFixed(2)}% from entry
          </div>
          <div className="text-[10px] text-gray-600 mt-2 leading-relaxed">
            {rec.stopLossRationale}
          </div>
        </div>

        {/* Entry */}
        <div className="group relative bg-dark-800 rounded-xl border border-blue-500/30 p-4 hover:border-blue-500/50 transition-all duration-300 ring-1 ring-blue-500/10">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Entry Price</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatPrice(rec.entryPrice)}
          </div>
          <div className="text-xs text-gray-500">
            Current: {formatPrice(currentPrice)} {currency}
          </div>
          <div className="text-[10px] text-gray-600 mt-2 leading-relaxed">
            {rec.entryRationale}
          </div>
        </div>

        {/* Take Profit */}
        <div className="group relative bg-dark-800 rounded-xl border border-emerald-500/20 p-4 hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Take Profit</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatPrice(rec.takeProfitConservative)}
          </div>
          <div className="text-xs text-emerald-400/80">
            +{rec.takeProfitPercent.toFixed(2)}% from entry
          </div>
          <div className="text-[10px] text-gray-600 mt-2 leading-relaxed">
            2:1 R:R target • Aggressive: {formatPrice(rec.takeProfitAggressive)}
          </div>
        </div>
      </div>

      {/* ─── Visual Price Ladder ─── */}
      <div className="relative bg-dark-800 rounded-xl border border-dark-600 p-4 mb-4">
        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-4">
          Price Ladder
        </div>

        {/* The ladder bar */}
        <div className="relative h-8 mx-8">
          {/* Background track */}
          <div className="absolute inset-0 rounded-full bg-dark-700 overflow-hidden">
            {/* Red zone (SL → Entry) */}
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-red-500/30 to-red-500/10 rounded-l-full"
              style={{
                left: `${getPosition(rec.stopLoss)}%`,
                width: `${getPosition(rec.entryPrice) - getPosition(rec.stopLoss)}%`,
              }}
            />
            {/* Green zone (Entry → TP Aggressive) */}
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-500/10 to-emerald-500/30 rounded-r-full"
              style={{
                left: `${getPosition(rec.entryPrice)}%`,
                width: `${getPosition(rec.takeProfitAggressive) - getPosition(rec.entryPrice)}%`,
              }}
            />
          </div>

          {/* Stop Loss marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 border-2 border-dark-800 shadow-lg shadow-red-500/50 z-10"
            style={{ left: `${getPosition(rec.stopLoss)}%`, transform: 'translate(-50%, -50%)' }}
          />

          {/* Entry marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-dark-800 shadow-lg shadow-blue-500/50 z-20"
            style={{ left: `${getPosition(rec.entryPrice)}%`, transform: 'translate(-50%, -50%)' }}
          />

          {/* Current price marker (if different from entry) */}
          {Math.abs(currentPrice - rec.entryPrice) / rec.entryPrice > 0.003 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-dark-800 shadow-lg z-15"
              style={{
                left: `${Math.max(0, Math.min(100, getPosition(currentPrice)))}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          {/* TP Conservative marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 border-2 border-dark-800 shadow-lg shadow-emerald-500/50 z-10"
            style={{ left: `${getPosition(rec.takeProfitConservative)}%`, transform: 'translate(-50%, -50%)' }}
          />

          {/* TP Aggressive marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm rotate-45 bg-emerald-400 border-2 border-dark-800 shadow-lg shadow-emerald-400/50 z-10"
            style={{ left: `${getPosition(rec.takeProfitAggressive)}%`, transform: 'translate(-50%, -50%) rotate(45deg)' }}
          />
        </div>

        {/* Labels below the ladder */}
        <div className="relative h-10 mx-8 mt-1">
          <div className="absolute text-[10px] text-red-400 font-semibold whitespace-nowrap"
               style={{ left: `${getPosition(rec.stopLoss)}%`, transform: 'translateX(-50%)' }}>
            SL
          </div>
          <div className="absolute text-[10px] text-blue-400 font-semibold whitespace-nowrap"
               style={{ left: `${getPosition(rec.entryPrice)}%`, transform: 'translateX(-50%)' }}>
            Entry
          </div>
          <div className="absolute text-[10px] text-emerald-400 font-semibold whitespace-nowrap"
               style={{ left: `${getPosition(rec.takeProfitConservative)}%`, transform: 'translateX(-50%)' }}>
            TP 2:1
          </div>
          <div className="absolute text-[10px] text-emerald-300 font-semibold whitespace-nowrap"
               style={{ left: `${getPosition(rec.takeProfitAggressive)}%`, transform: 'translateX(-50%)' }}>
            TP 3:1
          </div>
        </div>

        {/* R:R Ratio */}
        <div className="flex items-center justify-center gap-4 mt-2 pt-3 border-t border-dark-600">
          <div className="text-center">
            <div className="text-xs text-gray-500">Risk</div>
            <div className="text-sm font-bold text-red-400">{rec.stopLossPercent.toFixed(2)}%</div>
          </div>
          <div className="text-gray-600 text-lg font-light">:</div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Reward</div>
            <div className="text-sm font-bold text-emerald-400">{rec.takeProfitPercent.toFixed(2)}%</div>
          </div>
          <div className="text-gray-600 text-lg font-light">=</div>
          <div className="text-center">
            <div className="text-xs text-gray-500">R:R</div>
            <div className={`text-sm font-bold ${rec.riskRewardRatio >= 2 ? 'text-emerald-400' : rec.riskRewardRatio >= 1.5 ? 'text-amber-400' : 'text-red-400'}`}>
              1:{rec.riskRewardRatio.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Expandable Details ─── */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors py-2"
      >
        <span className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5" />
          Confidence Factors & Methodology
        </span>
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showDetails && (
        <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Confidence Score Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-medium">Confidence Score</span>
              <span className={`font-bold ${conf.text}`}>{rec.confidenceScore}/100</span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  rec.confidence === 'HIGH' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                  rec.confidence === 'MEDIUM' ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                  'bg-gradient-to-r from-red-600 to-red-400'
                }`}
                style={{ width: `${rec.confidenceScore}%` }}
              />
            </div>
          </div>

          {/* Factors */}
          <div className="space-y-1.5">
            {rec.confidenceFactors.map((factor, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  factor.includes('caution') || factor.includes('bearish') || factor.includes('overbought') || factor.includes('above') || factor.includes('High volatility')
                    ? 'bg-red-400' : 'bg-emerald-400'
                }`} />
                <span className="text-gray-400">{factor}</span>
              </div>
            ))}
          </div>

          {/* ATR Info */}
          <div className="flex gap-4 text-xs text-gray-600 pt-2 border-t border-dark-700">
            <span>ATR(14): {rec.atrValue}</span>
            <span>ATR%: {rec.atrPercent}%</span>
            <span>SL Method: {rec.stopLossPercent > 0 ? `${(1.5).toFixed(1)}× ATR` : 'Structural'}</span>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 mt-4 pt-3 border-t border-dark-700">
        <AlertTriangle className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Algorithmically generated levels for educational purposes only. Not financial advice. Always do your own research and consider your personal risk tolerance before making trading decisions.
        </p>
      </div>
    </div>
  );
}
