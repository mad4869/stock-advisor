'use client';

import { CompositeScore } from '@/types/scoring';

interface Props {
  score: CompositeScore;
}

export default function ScoreBreakdown({ score }: Props) {
  const { technical, fundamental, valuation } = score.breakdown;

  const total = score.totalScore;
  const techPct = (technical.total / 100) * 100; // Since total is 100, these are just percentages of the whole bar
  const fundPct = (fundamental.total / 100) * 100;
  const valPct = (valuation.total / 100) * 100;

  return (
    <div className="card space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white mb-2">Score Composition</h3>
        <p className="text-sm text-gray-400">
          How the 3 distinct analysis modules contribute to the final {Math.round(total)}/100 score.
        </p>
      </div>

      {/* Stacked Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold text-gray-400 mb-1 px-1">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
        <div className="h-6 w-full bg-dark-700 rounded-full overflow-hidden flex ring-1 ring-white/5">
          <div 
            className="h-full bg-blue-500 transition-all duration-1000 ease-out"
            style={{ width: `${techPct}%` }}
            title={`Technical: ${Math.round(technical.total)}`}
          />
          <div 
            className="h-full bg-purple-500 transition-all duration-1000 ease-out delay-150"
            style={{ width: `${fundPct}%` }}
            title={`Fundamental: ${Math.round(fundamental.total)}`}
          />
          <div 
            className="h-full bg-emerald-500 transition-all duration-1000 ease-out delay-300"
            style={{ width: `${valPct}%` }}
            title={`Valuation: ${Math.round(valuation.total)}`}
          />
        </div>
      </div>

      {/* Legend / Individual Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-dark-600">
        
        {/* Technical */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm font-bold text-white">Technical</span>
            </div>
            <span className="text-sm font-bold text-blue-400">
              {Math.round(technical.total)} <span className="text-gray-500 text-xs font-normal">/ 30</span>
            </span>
          </div>
          <div className="h-2 w-full bg-dark-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${(technical.total / 30) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400">Trend & Momentum</p>
        </div>

        {/* Fundamental */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm font-bold text-white">Fundamental</span>
            </div>
            <span className="text-sm font-bold text-purple-400">
              {Math.round(fundamental.total)} <span className="text-gray-500 text-xs font-normal">/ 35</span>
            </span>
          </div>
          <div className="h-2 w-full bg-dark-700 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${(fundamental.total / 35) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400">Profitability & Health</p>
        </div>

        {/* Valuation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm font-bold text-white">Valuation</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">
              {Math.round(valuation.total)} <span className="text-gray-500 text-xs font-normal">/ 35</span>
            </span>
          </div>
          <div className="h-2 w-full bg-dark-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(valuation.total / 35) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400">DCF Intrinsic Value</p>
        </div>

      </div>
    </div>
  );
}
