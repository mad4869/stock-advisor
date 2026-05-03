'use client';

import React, { useEffect, useState } from 'react';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';
import { useWatchlistStore } from '@/lib/watchlistStore';
import { Market, WatchlistItem } from '@/types';
import { AlertCircle, Save } from 'lucide-react';

interface RecordBuyFormProps {
  symbol: string;
  market: Market;
  currentPrice: number;
  stockName: string;
  fcdstScoreSnapshot?: WatchlistItem['fcdstScore'];
  onCancel: () => void;
  onSuccess: () => void;
}

export function RecordBuyForm({
  symbol,
  market,
  currentPrice,
  stockName,
  fcdstScoreSnapshot,
  onCancel,
  onSuccess,
}: RecordBuyFormProps) {
  const storyData = useStoryAnalysisStore(state => state.analyses[symbol]);
  const addItem = useWatchlistStore(state => state.addItem);

  // Buy Details
  const [buyPrice, setBuyPrice] = useState((currentPrice ?? 0).toString());
  const [quantity, setQuantity] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);

  // Thesis Fields
  const [summary, setSummary] = useState('');
  const [fairValue, setFairValue] = useState('');
  const [targetReturn, setTargetReturn] = useState('');
  const [holdPeriod, setHoldPeriod] = useState('');

  // Pre-filled from Story Analysis
  const [megatrendNote, setMegatrendNote] = useState(storyData?.megatrend?.justification || '');
  const [moatNote, setMoatNote] = useState(storyData?.moat?.justification || '');
  const [catalystNote, setCatalystNote] = useState(storyData?.catalyst?.justification || '');

  const [error, setError] = useState('');

  useEffect(() => {
    setMegatrendNote(storyData?.megatrend?.justification || '');
    setMoatNote(storyData?.moat?.justification || '');
    setCatalystNote(storyData?.catalyst?.justification || '');
  }, [storyData]);

  const handleSave = () => {
    setError('');
    
    // Validations
    if (!buyPrice || !quantity) {
      setError('Buy Price and Quantity are required.');
      return;
    }

    const trimmedSummary = summary.trim();
    if (trimmedSummary.length < 20) {
      setError('Investment thesis summary must be at least 20 characters.');
      return;
    }

    const bPrice = parseFloat(buyPrice);
    const qty = parseInt(quantity, 10);
    if (isNaN(bPrice) || bPrice <= 0 || isNaN(qty) || qty <= 0) {
      setError('Please enter valid positive numbers for price and quantity.');
      return;
    }

    const parsedFairValue = fairValue.trim() ? parseFloat(fairValue) : undefined;
    const parsedTargetReturn = targetReturn.trim() ? parseFloat(targetReturn) : undefined;
    if (
      (parsedFairValue !== undefined && (isNaN(parsedFairValue) || parsedFairValue <= 0)) ||
      (parsedTargetReturn !== undefined && isNaN(parsedTargetReturn))
    ) {
      setError('Please enter valid optional thesis numbers or leave them empty.');
      return;
    }

    // Save
    addItem({
      symbol: symbol.toUpperCase(),
      market,
      name: stockName,
      buyPrice: bPrice,
      quantity: qty,
      buyDate,
      stopLossPrice: null,
      takeProfitPrice: null,
      fcdstScore: fcdstScoreSnapshot || null,
      thesis: {
        summary: trimmedSummary,
        megatrendNote: megatrendNote.trim() || undefined,
        moatNote: moatNote.trim() || undefined,
        catalystNote: catalystNote.trim() || undefined,
        fairValue: parsedFairValue,
        targetReturn: parsedTargetReturn,
        holdPeriod: holdPeriod.trim() || undefined,
      }
    });

    onSuccess();
  };

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 shadow-xl w-full max-w-2xl mx-auto animate-fade-in text-left">
      <h2 className="text-xl font-bold text-white mb-4 border-b border-dark-700 pb-2">
        Record Buy Transaction: <span className="text-blue-400">{symbol}</span>
      </h2>

      {fcdstScoreSnapshot && (
        <div className="mb-6 bg-dark-900 border border-dark-700 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-gray-400">FCDS-T Score Snapshot:</span>
          <span className="font-bold text-white">
            {fcdstScoreSnapshot.totalScore === 'Incomplete' ? 'Inc.' : `${fcdstScoreSnapshot.totalScore}/15`} 
            <span className="ml-1 text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
              [{fcdstScoreSnapshot.grade}]
            </span>
            <span className="ml-2 text-xs text-green-400">✅ Auto-captured</span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="record-buy-price" className="label">Buy Price ({market === 'ID' ? 'Rp' : '$'}) *</label>
          <input 
            id="record-buy-price"
            type="number" 
            value={buyPrice} 
            onChange={(e) => setBuyPrice(e.target.value)}
            className="input-field"
            min="0"
            step="any"
          />
        </div>
        <div>
          <label htmlFor="record-buy-quantity" className="label">Quantity ({market === 'ID' ? 'lots' : 'shares'}) *</label>
          <input 
            id="record-buy-quantity"
            type="number" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)}
            className="input-field"
            min="1"
          />
        </div>
        <div>
          <label htmlFor="record-buy-date" className="label">Buy Date *</label>
          <input 
            id="record-buy-date"
            type="date" 
            value={buyDate} 
            onChange={(e) => setBuyDate(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="record-buy-summary" className="label text-blue-400">Investment Thesis *</label>
        <p className="text-xs text-gray-500 mb-2">Why are you buying this stock? (min 20 characters)</p>
        <textarea
          id="record-buy-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="I'm buying this because..."
          className="input-field min-h-[80px] resize-y"
        />
      </div>

      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-bold text-gray-400 border-b border-dark-700 pb-1">Pre-filled from Story Analysis</h3>
        <div>
          <label className="text-xs text-gray-500 font-medium">Megatrend Note</label>
          <input
            type="text"
            value={megatrendNote}
            onChange={(e) => setMegatrendNote(e.target.value)}
            placeholder="No megatrend note"
            className="input-field text-sm py-1.5"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Moat Note</label>
          <input
            type="text"
            value={moatNote}
            onChange={(e) => setMoatNote(e.target.value)}
            placeholder="No moat note"
            className="input-field text-sm py-1.5"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Catalyst Note</label>
          <input
            type="text"
            value={catalystNote}
            onChange={(e) => setCatalystNote(e.target.value)}
            placeholder="No catalyst note"
            className="input-field text-sm py-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="label">Fair Value Estimate</label>
          <input 
            type="number" 
            value={fairValue} 
            onChange={(e) => setFairValue(e.target.value)}
            className="input-field"
            placeholder={market === 'ID' ? 'Rp' : '$'}
            step="any"
          />
        </div>
        <div>
          <label className="label">Target Return (%)</label>
          <input 
            type="number" 
            value={targetReturn} 
            onChange={(e) => setTargetReturn(e.target.value)}
            className="input-field"
            placeholder="e.g. 20"
            step="any"
          />
        </div>
        <div>
          <label className="label">Hold Period</label>
          <select 
            value={holdPeriod} 
            onChange={(e) => setHoldPeriod(e.target.value)}
            className="input-field"
          >
            <option value="">No target</option>
            <option value="< 1 year">&lt; 1 year</option>
            <option value="1-3 years">1-3 years</option>
            <option value="3-5 years">3-5 years</option>
            <option value="5+ years">5+ years</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 btn-secondary py-3">
          Cancel
        </button>
        <button onClick={handleSave} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          💾 Save & Record Transaction
        </button>
      </div>
    </div>
  );
}
