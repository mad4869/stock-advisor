'use client';

import { Market } from '@/types';

interface MarketToggleProps {
  market: Market;
  onChange: (market: Market) => void;
}

export default function MarketToggle({ market, onChange }: MarketToggleProps) {
  return (
    <div className="inline-flex bg-dark-800 rounded-xl border border-dark-500 p-1">
      <button
        onClick={() => onChange('US')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          market === 'US'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <span>🇺🇸</span>
        US Market
      </button>
      <button
        onClick={() => onChange('ID')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          market === 'ID'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <span>🇮🇩</span>
        IDX Market
      </button>
    </div>
  );
}