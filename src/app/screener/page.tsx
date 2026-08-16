'use client';

import { useState } from 'react';
import StockScreener from '@/components/StockScreener';
import StableScreener from '@/components/StableScreener';

type ScreenerTab = 'swing' | 'defensive' | 'dividend';

const tabs: { id: ScreenerTab; label: string; description: string }[] = [
  { id: 'swing',     label: '🔍 Swing',    description: 'Active TA setups with momentum & volume signals' },
  { id: 'defensive', label: '🛡️ Defensive', description: 'Low-beta, dividend-paying stocks for stability' },
  { id: 'dividend',  label: '💰 Dividend',  description: 'High-yield dividend stocks with strong fundamentals' },
];

export default function ScreenerPage() {
  const [activeTab, setActiveTab] = useState<ScreenerTab>('swing');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Stock Screener</h1>
        <p className="text-sm text-gray-400">
          {tabs.find(t => t.id === activeTab)?.description}
        </p>
      </div>

      {/* Tab Strip */}
      <div className="flex gap-2 border-b border-dark-600 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-white bg-blue-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'swing' && <StockScreener />}
      {activeTab === 'defensive' && <StableScreener mode="DEFENSIVE" />}
      {activeTab === 'dividend' && <StableScreener mode="HIGH_YIELD_DIVIDEND" />}
    </div>
  );
}
