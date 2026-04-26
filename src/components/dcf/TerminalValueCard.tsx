import React from 'react';
import { DCFResult } from '@/types/dcf';
import { AlertTriangle } from 'lucide-react';

interface Props {
  result: DCFResult;
  currencySymbol: string;
}

export default function TerminalValueCard({ result, currencySymbol }: Props) {
  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 1e9) return `${currencySymbol}${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `${currencySymbol}${(val / 1e6).toFixed(2)}M`;
    return `${currencySymbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const tvPercent = result.terminalValuePercentOfEV;
  const isHighDependency = tvPercent > 75;

  return (
    <div className="card bg-gradient-to-br from-gray-900 to-black">
      <h3 className="text-lg font-semibold text-white mb-4">Terminal Value</h3>
      <p className="text-sm text-gray-400 mb-6">
        Calculated using the Gordon Growth Model, representing the value of the company into perpetuity beyond Year 10.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="text-sm text-gray-500 mb-1">Raw Terminal Value</div>
          <div className="text-xl font-semibold text-gray-300">
            {formatCurrency(result.terminalValue)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="text-sm text-blue-300/70 mb-1">PV of Terminal Value</div>
          <div className="text-xl font-bold text-blue-400">
            {formatCurrency(result.pvOfTerminalValue)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Terminal Value Weight</span>
          <span className={`font-semibold ${isHighDependency ? 'text-orange-400' : 'text-gray-300'}`}>
            {tvPercent.toFixed(1)}% of Enterprise Value
          </span>
        </div>
        
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${isHighDependency ? 'bg-orange-500' : 'bg-blue-500'}`} 
            style={{ width: `${Math.min(tvPercent, 100)}%` }}
          />
        </div>

        {isHighDependency && (
          <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              High dependence on Terminal Value (&gt;75%). This valuation is highly sensitive to the Terminal Growth and WACC assumptions. Consider reviewing your inputs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
