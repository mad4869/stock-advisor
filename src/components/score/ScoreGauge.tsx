'use client';

import { RecommendationSignal } from '@/types/scoring';

interface Props {
  score: number;
  recommendation: RecommendationSignal;
}

export default function ScoreGauge({ score, recommendation }: Props) {
  // SVG viewBox and parameters
  const size = 300;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 30; // Shift down a bit for the semi-circle

  // Calculate arc path for a semi-circle (0 to 180 degrees)
  const calculateDashArray = (percentage: number) => {
    // Circumference of semi-circle is Pi * r
    const arcLength = Math.PI * radius;
    const filled = (percentage / 100) * arcLength;
    const empty = arcLength - filled;
    return `${filled} ${empty}`;
  };

  const getColors = (rec: RecommendationSignal) => {
    switch (rec) {
      case 'STRONG BUY': return { text: 'text-green-400', stroke: '#4ade80' };
      case 'BUY': return { text: 'text-green-500', stroke: '#22c55e' };
      case 'HOLD': return { text: 'text-yellow-400', stroke: '#facc15' };
      case 'UNDERPERFORM': return { text: 'text-orange-400', stroke: '#fb923c' };
      case 'AVOID': return { text: 'text-red-500', stroke: '#ef4444' };
      default: return { text: 'text-gray-400', stroke: '#9ca3af' };
    }
  };

  const colors = getColors(recommendation);

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-sm mx-auto shadow-2xl">
      <div className="relative w-full aspect-[2/1] overflow-hidden flex justify-center">
        <svg
          viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
          className="w-full h-full overflow-visible drop-shadow-2xl"
        >
          {/* Background track */}
          <path
            d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
            fill="none"
            stroke="#1f2937" // dark-700
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Colored progress */}
          <path
            d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={calculateDashArray(100)}
            strokeDashoffset={calculateDashArray(100).split(' ')[0]}
            className="transition-all duration-1000 ease-out animate-gauge"
            style={{ strokeDashoffset: calculateDashArray(100 - score).split(' ')[0] }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center translate-y-2">
          <span className="text-6xl font-black text-white tracking-tighter" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {Math.round(score)}
          </span>
          <span className="text-sm font-medium text-gray-500 mt-1 uppercase tracking-widest">
            / 100
          </span>
        </div>
      </div>

      <div className={`mt-8 px-6 py-2 rounded-full border border-current/20 bg-current/10 ${colors.text}`}>
        <span className="text-lg font-bold tracking-wide">{recommendation}</span>
      </div>
    </div>
  );
}
