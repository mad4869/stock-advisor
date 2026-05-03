import React from 'react';
import { FCDSTScore, TechnicalData, VolumeAccumulationSignal } from '@/types/fcdst';
import { calculateVolumeAccumulation } from '@/lib/fcdstEngine';
import { CheckCircle, XCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react';

interface TimingSignalsProps {
  technicalData?: TechnicalData;
  tScore?: FCDSTScore['tScore'];
}

export function TimingSignals({ technicalData, tScore }: TimingSignalsProps) {
  if (!technicalData || !tScore) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Timing Signals (T)</h3>
        <p className="text-gray-400">Technical data unavailable. Use external tools for timing analysis.</p>
      </div>
    );
  }

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
  const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR' }).format(num);

  let mosPct = 0;
  if (technicalData.fairValue && technicalData.fairValue > 0) {
    mosPct = ((technicalData.fairValue - technicalData.price) / technicalData.fairValue) * 100;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BUY ZONE': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'ACCUMULATE': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'WAIT': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      default: return 'text-gray-400 bg-dark-700 border-dark-600';
    }
  };

  // Volume Accumulation Proxy
  const accum: VolumeAccumulationSignal = calculateVolumeAccumulation(technicalData);

  const confidenceBadgeColor: Record<string, string> = {
    high: 'bg-green-500/20 text-green-400 border border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    low: 'bg-gray-700 text-gray-400 border border-dark-600',
  };

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 shadow-lg">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-dark-600">
        <h3 className="text-lg font-bold text-white">Timing Signals (T)</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(tScore.status)}`}>
          Action: {tScore.status}
        </div>
      </div>

      <div className="space-y-4">
        {/* Signal 1: Price vs MA20 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tScore.priceAboveMA20 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-gray-200">Price vs MA20</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-white">{formatCurrency(technicalData.price)} vs {formatCurrency(technicalData.ma20)}</span>
            <span className="text-xs text-gray-400 ml-2">
              ({tScore.priceAboveMA20 ? 'Above' : 'Below'})
            </span>
          </div>
        </div>

        {/* Signal 2: RSI(14) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tScore.rsiFavorable ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            )}
            <span className="text-gray-200">RSI (14)</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-white">{technicalData.rsi14.toFixed(1)}</span>
            <span className="text-xs text-gray-400 ml-2">
              ({tScore.rsiFavorable ? '40-60' : 'Outside range'})
            </span>
          </div>
        </div>

        {/* Signal 3: Volume */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tScore.volumeSpike ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-gray-200">Volume</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-white">{formatNumber(technicalData.volume)} vs {formatNumber(technicalData.volume20dAvg)}</span>
            <span className="text-xs text-gray-400 ml-2">
              ({tScore.volumeSpike ? 'Spike' : 'Normal'})
            </span>
          </div>
        </div>

        {/* Signal 4: Margin of Safety */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tScore.mosFavorable ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-gray-200">Margin of Safety</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-white">
              {technicalData.fairValue ? `${mosPct.toFixed(1)}%` : 'N/A'}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              ({tScore.mosFavorable ? '>30%' : '<30%'})
            </span>
          </div>
        </div>

        {/* Signal 5: Volume Accumulation Proxy (Informational — does NOT affect scoring) */}
        <div className="pt-3 mt-2 border-t border-dark-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrendingUp
                className={`w-5 h-5 ${accum.isAccumulating ? 'text-blue-400' : 'text-gray-500'}`}
              />
              <div>
                <span className="text-gray-200 text-sm">Accumulation Proxy</span>
                <span className="text-gray-500 text-xs ml-2">(heuristic)</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    accum.isAccumulating
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-dark-700 text-gray-500 border border-dark-600'
                  }`}
                >
                  {accum.isAccumulating ? 'DETECTED' : 'NOT DETECTED'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${confidenceBadgeColor[accum.confidence]}`}>
                  {accum.confidence} conf.
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Vol: {accum.volumeRatio.toFixed(1)}× avg | Close pos: {(accum.closingPosition * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-3 flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-300/80 leading-relaxed">
              Volume Accumulation Proxy is a heuristic estimate, not actual broker-level smart money data. Use as supplementary signal only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
