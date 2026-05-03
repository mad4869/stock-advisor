import React from 'react';
import { FCDSTScore } from '@/types/fcdst';
import { AlertCircle, CheckCircle2, ChevronRight, Star } from 'lucide-react';

interface FCDSTScoreCardProps {
  score: FCDSTScore;
  onManualInputClick?: () => void;
  className?: string;
}

const GradeBadge = ({ grade }: { grade: FCDSTScore['grade'] }) => {
  if (grade === 'Incomplete') {
    return <div className="px-3 py-1 bg-gray-500/20 text-gray-400 font-bold rounded-full text-sm border border-gray-500/30">Inc.</div>;
  }
  
  const baseColors = {
    'A+': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'B': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    'C': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'D': 'bg-red-500/20 text-red-400 border border-red-500/30',
  };
  
  // Handle pending grades like "B (Pending Story)"
  const letter = grade.split(' ')[0] as keyof typeof baseColors;
  const colorClass = baseColors[letter] || baseColors['D'];
  
  return (
    <div className={`px-3 py-1 font-bold rounded-full text-sm ${colorClass}`}>
      {letter}
    </div>
  );
};

const ProgressBar = ({ value, max, incomplete }: { value: number, max: number, incomplete?: boolean }) => {
  const pct = incomplete ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className="w-full bg-dark-700 h-2 rounded-full overflow-hidden mt-1.5">
      <div 
        className={`h-full transition-all duration-500 ${incomplete ? 'bg-gray-500' : 'bg-blue-500'}`} 
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
};

export function FCDSTScoreCard({ score, onManualInputClick, className = '' }: FCDSTScoreCardProps) {
  const isDIncomplete = score.dScore.status === 'incomplete';
  const isSIncomplete = typeof score.sScore !== 'number';
  
  return (
    <div className={`bg-dark-800 border border-dark-600 rounded-xl p-5 shadow-lg flex flex-col ${className}`}>
      
      {/* Header section */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-dark-600">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
            FCDS-T Score
            {score.fDetails.bonusFcfPass && (
              <span title="Positive Free Cash Flow Bonus" className="flex items-center text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20 whitespace-nowrap">
                <Star className="w-3 h-3 mr-1 fill-yellow-400" /> FCF Bonus
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-400">Value Investing Methodology</p>
          {score.grade.includes('Pending Story') && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Pending Story Analysis
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-3xl font-black text-white">
              {score.totalScore === 'Incomplete' ? '--' : score.totalScore}
              <span className="text-lg text-gray-500 font-medium">/15</span>
            </div>
          </div>
          <GradeBadge grade={score.grade} />
        </div>
      </div>
      
      {/* Sub-scores grid */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        
        {/* F */}
        <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-gray-300">Fundamental (Quality)</span>
            <span className="text-sm font-bold text-white">{score.fScore}/5</span>
          </div>
          <ProgressBar value={score.fScore} max={5} />
        </div>

        {/* C */}
        <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-gray-300">Cheap (Valuation)</span>
            <span className="text-sm font-bold text-white">{score.cScore}/4</span>
          </div>
          <ProgressBar value={score.cScore} max={4} />
        </div>

        {/* D */}
        <div className="bg-dark-900 rounded-lg p-3 border border-dark-700 relative overflow-hidden group">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-gray-300">Debt (Health)</span>
            <span className="text-sm font-bold text-white">
              {isDIncomplete ? 'Inc.' : `${score.dScore.score}/3`}
            </span>
          </div>
          <ProgressBar value={isDIncomplete ? 0 : score.dScore.score} max={3} incomplete={isDIncomplete} />
          
          {isDIncomplete && onManualInputClick && (
            <div className="absolute inset-0 bg-dark-900/90 backdrop-blur-sm flex items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                onClick={onManualInputClick}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white py-1 px-3 rounded-full font-medium transition-colors w-full flex items-center justify-center"
               >
                 Input NPL/CAR
                 <ChevronRight className="w-3 h-3 ml-1" />
               </button>
            </div>
          )}
        </div>

        {/* S */}
        <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold text-gray-300">Story (Moat)</span>
            <span className="text-sm font-bold text-white">
              {score.sScore === 'Pending' ? 'Pend.' : isSIncomplete ? 'Inc.' : `${score.sScore}/3`}
            </span>
          </div>
          <ProgressBar value={isSIncomplete || score.sScore === 'Pending' ? 0 : score.sScore as number} max={3} incomplete={isSIncomplete || score.sScore === 'Pending'} />
        </div>
      </div>
      
      {/* Timing (T) Section */}
      <div className="mt-5 pt-4 border-t border-dark-600">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-200">Timing (Action)</h4>
          {score.tScore ? (
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
              score.tScore.status === 'BUY ZONE' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
              score.tScore.status === 'ACCUMULATE' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {score.tScore.status}
            </span>
          ) : (
            <span className="text-xs text-gray-500 font-medium italic">Not yet analyzed</span>
          )}
        </div>
        
        {score.tScore && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={`text-xs p-2 rounded border flex items-center justify-between ${score.tScore.priceAboveMA20 ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-dark-700 border-dark-600 text-gray-400'}`}>
              <span>Price &gt; MA20</span>
              {score.tScore.priceAboveMA20 && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <div className={`text-xs p-2 rounded border flex items-center justify-between ${score.tScore.rsiFavorable ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-dark-700 border-dark-600 text-gray-400'}`}>
              <span>RSI 40-60</span>
              {score.tScore.rsiFavorable && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <div className={`text-xs p-2 rounded border flex items-center justify-between ${score.tScore.volumeSpike ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-dark-700 border-dark-600 text-gray-400'}`}>
              <span>Vol Spike</span>
              {score.tScore.volumeSpike && <CheckCircle2 className="w-3 h-3" />}
            </div>
            <div className={`text-xs p-2 rounded border flex items-center justify-between ${score.tScore.mosFavorable ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-dark-700 border-dark-600 text-gray-400'}`}>
              <span>MoS &gt; 30%</span>
              {score.tScore.mosFavorable && <CheckCircle2 className="w-3 h-3" />}
            </div>
          </div>
        )}
      </div>
      
      {/* Incomplete Warning */}
      {(isDIncomplete || isSIncomplete) && (
        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-yellow-200 font-medium">Incomplete Assessment</p>
            <p className="text-yellow-400/80 mt-0.5">
              {isDIncomplete && "Bank sector requires manual NPL/CAR inputs. "}
              {isSIncomplete && "Qualitative Story analysis required."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
