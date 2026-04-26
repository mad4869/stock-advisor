import React from 'react';
import { DCFScenario, ScenarioType } from '@/types/dcf';
import { Settings2 } from 'lucide-react';

interface Props {
  scenarios: Record<ScenarioType, DCFScenario>;
  activeScenario: ScenarioType;
  onScenarioSelect: (type: ScenarioType) => void;
  currentPrice: number;
  currencySymbol: string;
}

export default function ScenarioManager({ scenarios, activeScenario, onScenarioSelect, currentPrice, currencySymbol }: Props) {
  
  // Calculate range bounds for the visualization
  const getValues = () => {
    const vals = [
      scenarios.conservative.result?.intrinsicValuePerShare || 0,
      scenarios.base.result?.intrinsicValuePerShare || 0,
      scenarios.optimistic.result?.intrinsicValuePerShare || 0,
    ].filter(v => v > 0);
    
    if (vals.length === 0) return { min: 0, max: 100, currentPercent: 0, getPercent: () => 0 };
    
    // Add current price to the range consideration
    const minVal = Math.min(...vals, currentPrice) * 0.8; // 20% padding
    const maxVal = Math.max(...vals, currentPrice) * 1.2;
    const range = maxVal - minVal;
    
    return {
      min: minVal,
      max: maxVal,
      range,
      getPercent: (val: number) => ((val - minVal) / range) * 100,
    };
  };

  const bounds = getValues();

  const renderScenarioButton = (type: ScenarioType, label: string, colorClass: string) => {
    const isActive = activeScenario === type;
    const result = scenarios[type].result;
    const value = result?.intrinsicValuePerShare || 0;
    
    return (
      <button
        onClick={() => onScenarioSelect(type)}
        className={`flex-1 flex flex-col items-center p-3 rounded-xl border transition-all duration-200
          ${isActive 
            ? `${colorClass} border-current shadow-lg scale-[1.02]` 
            : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'}`}
      >
        <span className="text-sm font-medium mb-1">{label}</span>
        {value > 0 ? (
          <span className={`text-lg font-bold ${isActive ? '' : 'text-gray-400'}`}>
            {currencySymbol}{value.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-gray-600">Calculating...</span>
        )}
      </button>
    );
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-gray-400" />
          Scenario Analysis
        </h3>
      </div>

      <div className="flex gap-4 mb-8">
        {renderScenarioButton('conservative', 'Conservative', 'bg-orange-500/10 text-orange-400')}
        {renderScenarioButton('base', 'Base Case', 'bg-blue-500/10 text-blue-400')}
        {renderScenarioButton('optimistic', 'Optimistic', 'bg-green-500/10 text-green-400')}
      </div>

      {/* Range Bar Visualization */}
      <div className="px-4">
        <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">
          Valuation Range vs Current Price
        </div>
        
        <div className="relative h-12 w-full mt-6 mb-4">
          {/* Base Track */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-800 rounded-full" />
          
          {/* Intrinsic Value Range Fill */}
          {scenarios.conservative.result && scenarios.optimistic.result && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-2 bg-gradient-to-r from-orange-500/50 via-blue-500/50 to-green-500/50 rounded-full"
              style={{
                left: `${bounds.getPercent(scenarios.conservative.result?.intrinsicValuePerShare || 0)}%`,
                right: `${100 - bounds.getPercent(scenarios.optimistic.result?.intrinsicValuePerShare || 0)}%`
              }}
            />
          )}

          {/* Markers */}
          {(['conservative', 'base', 'optimistic'] as ScenarioType[]).map((type) => {
            const val = scenarios[type].result?.intrinsicValuePerShare;
            if (!val) return null;
            const pct = bounds.getPercent(val);
            const color = type === 'conservative' ? 'bg-orange-500' : type === 'optimistic' ? 'bg-green-500' : 'bg-blue-500';
            
            return (
              <div 
                key={type}
                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center -ml-3 group"
                style={{ left: `${pct}%` }}
              >
                <div className={`w-6 h-6 rounded-full border-2 border-black shadow-lg z-10 ${color} ${activeScenario === type ? 'ring-2 ring-white scale-110' : ''}`} />
                <div className="absolute top-8 text-[10px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {scenarios[type].label}: {currencySymbol}{val.toFixed(2)}
                </div>
              </div>
            );
          })}

          {/* Current Price Marker */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center -ml-1.5 z-20"
            style={{ left: `${bounds.getPercent(currentPrice)}%` }}
          >
            <div className="w-1 h-8 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <div className="absolute -top-6 bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
              Price: {currencySymbol}{currentPrice.toFixed(2)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
