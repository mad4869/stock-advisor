'use client';

import { useState } from 'react';
import { CompositeScore, ScoreComponent } from '@/types/scoring';
import { ChevronDown, ChevronRight, Activity, Building2, Calculator } from 'lucide-react';

interface Props {
  score: CompositeScore;
}

export default function ScoreDetails({ score }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">Detailed Breakdown</h3>
      
      <CategoryAccordion 
        title="Technical Analysis" 
        score={score.breakdown.technical.total} 
        maxScore={30} 
        icon={<Activity className="w-5 h-5 text-blue-400" />}
        components={Object.values(score.breakdown.technical.components)}
        defaultOpen={true}
      />
      
      <CategoryAccordion 
        title="Fundamental Analysis" 
        score={score.breakdown.fundamental.total} 
        maxScore={35} 
        icon={<Building2 className="w-5 h-5 text-purple-400" />}
        components={Object.values(score.breakdown.fundamental.components)}
      />
      
      <CategoryAccordion 
        title="Valuation (DCF)" 
        score={score.breakdown.valuation.total} 
        maxScore={35} 
        icon={<Calculator className="w-5 h-5 text-emerald-400" />}
        components={Object.values(score.breakdown.valuation.components)}
      />
    </div>
  );
}

function CategoryAccordion({ 
  title, 
  score, 
  maxScore, 
  icon, 
  components,
  defaultOpen = false 
}: { 
  title: string; 
  score: number; 
  maxScore: number; 
  icon: React.ReactNode; 
  components: ScoreComponent[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card p-0 overflow-hidden bg-dark-800/50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-bold text-white">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-300">
            {Math.round(score)} <span className="text-gray-500 font-normal text-sm">/ {maxScore}</span>
          </span>
          {isOpen ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-dark-600 space-y-4">
          {components.map((comp, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-dark-800">
              <div>
                <div className="font-medium text-gray-300 text-sm">{comp.label}</div>
                {comp.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{comp.description}</div>
                )}
              </div>
              <div className="flex items-center gap-3 min-w-[120px] justify-end">
                <div className="text-sm font-bold text-white min-w-[40px] text-right">
                  {comp.score} <span className="text-gray-500 font-normal text-xs">/ {comp.maxScore}</span>
                </div>
                {/* Visual bar for the component if maxScore > 0 */}
                {comp.maxScore > 0 ? (
                  <div className="w-16 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${Math.max(0, Math.min(100, (comp.score / comp.maxScore) * 100))}%` }} 
                    />
                  </div>
                ) : (
                  <div className="w-16" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
