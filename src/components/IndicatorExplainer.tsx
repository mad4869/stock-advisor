'use client';

import { useState } from 'react';
import { IndicatorSignal } from '@/types';
import SignalBadge from './SignalBadge';
import { HelpCircle, X } from 'lucide-react';

interface IndicatorExplainerProps {
  indicator: IndicatorSignal;
}

export default function IndicatorExplainer({ indicator }: IndicatorExplainerProps) {
  const [showEducation, setShowEducation] = useState(false);

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-white">{indicator.name}</h4>
          <button
            onClick={() => setShowEducation(!showEducation)}
            className="text-gray-500 hover:text-blue-400 transition-colors"
            title="Learn about this indicator"
          >
            {showEducation ? <X className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
          </button>
        </div>
        <SignalBadge signal={indicator.signal} size="sm" />
      </div>

      <p className="text-xs text-gray-500 font-mono mb-2">Value: {indicator.value}</p>
      <p className="text-sm text-gray-300">{indicator.explanation}</p>

      {showEducation && (
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-fade-in">
          <div className="flex items-center gap-1.5 mb-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              What is this?
            </span>
          </div>
          <p className="text-sm text-blue-200/80 leading-relaxed">{indicator.educationalInfo}</p>
        </div>
      )}
    </div>
  );
}