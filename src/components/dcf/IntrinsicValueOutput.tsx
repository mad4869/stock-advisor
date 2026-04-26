import React from 'react';
import { DCFResult } from '@/types/dcf';

interface Props {
  result: DCFResult;
  currencySymbol: string;
}

export default function IntrinsicValueOutput({ result, currencySymbol }: Props) {
  const isUndervalued = result.marginOfSafety > 0;

  const getVerdictStyles = () => {
    switch (result.verdict) {
      case 'STRONG BUY':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'UNDERVALUED':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'FAIR':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'OVERVALUED':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
    }
  };

  return (
    <div className="card border-2 border-white/10 relative overflow-hidden">
      {/* Background Glow */}
      <div 
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none
          ${isUndervalued ? 'bg-green-500' : 'bg-red-500'}`}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        
        <div>
          <h2 className="text-gray-400 font-medium mb-2 uppercase tracking-wider text-sm">
            Estimated Intrinsic Value
          </h2>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-5xl font-bold text-white tracking-tight">
              {currencySymbol}{result.intrinsicValuePerShare.toFixed(2)}
            </span>
            <span className="text-gray-500 mb-1">/ share</span>
          </div>
          <div className="flex items-center gap-4 text-sm mt-4">
            <div className="flex flex-col">
              <span className="text-gray-500">Current Price</span>
              <span className="font-semibold text-gray-300">
                {currencySymbol}{result.currentPrice.toFixed(2)}
              </span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-gray-500">Margin of Safety</span>
              <span className={`font-semibold ${isUndervalued ? 'text-green-400' : 'text-red-400'}`}>
                {result.marginOfSafety > 0 ? '+' : ''}{result.marginOfSafety.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 min-w-[160px]">
          <div className={`px-4 py-2 rounded-full border font-bold tracking-wide text-sm shadow-lg backdrop-blur-md ${getVerdictStyles()}`}>
            {result.verdict === 'STRONG BUY' ? '🟢 STRONG BUY' : 
             result.verdict === 'UNDERVALUED' ? '🟢 UNDERVALUED' : 
             result.verdict === 'FAIR' ? '🟡 FAIR VALUE' : 
             '🔴 OVERVALUED'}
          </div>
        </div>

      </div>

      {/* Enterprise to Equity Bridge */}
      <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm relative z-10">
        <div>
          <div className="text-gray-500 text-xs mb-1">Enterprise Value</div>
          <div className="font-medium text-gray-300">
            {currencySymbol}{(result.enterpriseValue / 1e9).toFixed(2)}B
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Plus: Cash</div>
          <div className="font-medium text-green-400/80">
            + {currencySymbol}{(result.cashAndEquivalents / 1e9).toFixed(2)}B
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Less: Debt</div>
          <div className="font-medium text-red-400/80">
            - {currencySymbol}{(result.totalDebt / 1e9).toFixed(2)}B
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">Equity Value</div>
          <div className="font-medium text-blue-400">
            = {currencySymbol}{(result.equityValue / 1e9).toFixed(2)}B
          </div>
        </div>
      </div>
    </div>
  );
}
